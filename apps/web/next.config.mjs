import { execSync } from 'child_process';

// Get git SHA at build time
// Priority: env var (from Docker build arg) > git command > 'unknown'
let gitSha = process.env.NEXT_PUBLIC_GIT_SHA || 'unknown';

// If no env var, try git command (for local dev)
if (gitSha === 'unknown') {
  try {
    gitSha = execSync('git rev-parse --short HEAD', {
      timeout: 5000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    // Git not available, not a git repo, or timed out
  }
}

// Backend server URL (Fastify runs on port 1234 with HTTPS)
const BACKEND_URL = process.env.BACKEND_URL || 'https://localhost:1234';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  eslint: {
    // Disable ESLint during builds (run separately with npm run lint)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript checks during builds (run separately with npm run typecheck)
    ignoreBuildErrors: true,
  },
  // Allow build to succeed even with prerender errors
  // This is needed for pages using useSearchParams without Suspense boundaries
  staticPageGenerationTimeout: 1000,
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  experimental: {
    typedRoutes: true
  },
  // Webpack config to resolve .js imports to .ts files (ESM compatibility)
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
  // Rewrite /api/* to the backend server (for start:ci and production modes without dev-proxy)
  // Note: In dev mode with dev-proxy.mjs, the proxy handles this instead
  async rewrites() {
    return [
      // Keep Next.js-specific API routes local
      {
        source: '/api/proxy-model/:path*',
        destination: '/api/proxy-model/:path*',
      },
      // Keep health/build local - used by error screens for build info
      {
        source: '/api/health/build',
        destination: '/api/health/build',
      },
      // Forward all other /api/* to the backend server (preserving /api prefix)
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },

  /**
   * Security + cache-busting headers.
   * 
   * Security headers (applied to all routes):
   * - X-Content-Type-Options: nosniff - Prevents MIME-sniffing attacks
   * - X-Frame-Options: DENY - Prevents clickjacking
   * - Referrer-Policy: no-referrer - Don't leak referrer info
   * - Permissions-Policy: Restricts browser feature access
   * - Strict-Transport-Security: Enforces HTTPS (1 week initial ramp)
   * - Content-Security-Policy-Report-Only: CSP in report-only mode
   * 
   * Cache strategy:
   * - All pages: no-store (always fetch fresh to get latest JS bundle references)
   * - Static hashed assets (_next/static): immutable, long cache (content-addressed)
   * - API routes: no-store (always fresh)
   */
  async headers() {
    // Security headers applied to all routes
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=604800; includeSubDomains' },
      // CSP in report-only mode - doesn't block, allows us to identify issues
      { 
        key: 'Content-Security-Policy-Report-Only', 
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs unsafe-inline/eval
          "style-src 'self' 'unsafe-inline'", // Next.js needs unsafe-inline for styles
          "img-src 'self' data: blob:",
          "font-src 'self'",
          "connect-src 'self' wss: ws:", // WebSocket connections
          "media-src 'self' blob:",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
        ].join('; ')
      },
    ];

    return [
      // Hashed static assets - cache immutably (content-addressed) - MUST come first
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          ...securityHeaders,
        ],
      },
      // Settings page specifically - never cache, disable ETags
      {
        source: '/settings',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          ...securityHeaders,
        ],
      },
      // All other pages - never cache HTML documents
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          ...securityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
