import { execSync } from 'child_process';

// Get git SHA at build time
let gitSha = 'unknown';
try {
  gitSha = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  // Git not available or not a git repo
}

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
};

export default nextConfig;
