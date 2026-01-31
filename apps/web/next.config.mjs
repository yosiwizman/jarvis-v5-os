import { execSync } from 'child_process';

// Get git SHA at build time (with timeout to prevent CI hang)
let gitSha = 'unknown';
try {
  gitSha = execSync('git rev-parse --short HEAD', {
    timeout: 5000,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
} catch {
  // Git not available, not a git repo, or timed out
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
      // Forward all other /api/* to the backend server (stripping /api prefix)
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },

  /**
   * Cache-busting headers for deployment drift prevention.
   * 
   * Strategy:
   * - HTML pages: no-store (always fetch fresh to get latest JS bundle references)
   * - Static hashed assets (_next/static): immutable, long cache (content-addressed)
   * - API routes: no-store (always fresh)
   * 
   * This prevents browsers from serving stale HTML that references old JS bundles.
   */
  async headers() {
    return [
      // HTML pages - never cache to prevent serving stale bundle references
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'accept',
            value: '(.*text/html.*)',
          },
        ],
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      // Health/build endpoints - never cache
      {
        source: '/api/health/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
      // Hashed static assets - cache immutably (content-addressed)
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
