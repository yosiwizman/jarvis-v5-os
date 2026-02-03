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
   * Cache-busting headers for deployment drift prevention.
   * 
   * Strategy:
   * - All pages: no-store (always fetch fresh to get latest JS bundle references)
   * - Static hashed assets (_next/static): immutable, long cache (content-addressed)
   * - API routes: no-store (always fresh)
   * 
   * This prevents browsers from serving stale HTML that references old JS bundles.
   */
  async headers() {
    return [
      // Hashed static assets - cache immutably (content-addressed) - MUST come first
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Settings page specifically - never cache, disable ETags
      {
        source: '/settings',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      // All other pages - never cache HTML documents
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
