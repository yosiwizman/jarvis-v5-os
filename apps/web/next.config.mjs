/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
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
};

export default nextConfig;
