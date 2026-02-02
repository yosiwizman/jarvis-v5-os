import { NextResponse } from 'next/server';
import { BRAND_VERSION } from '@/lib/brand';

/**
 * GET /web-build
 * 
 * Returns build information for the Next.js web frontend specifically.
 * This endpoint is NOT routed through /api/* so it stays on the web container,
 * not the backend server.
 * 
 * Use this to:
 * - Verify which web build is currently deployed (vs server at /api/health/build)
 * - Detect web/server deployment drift
 * - Confirm both containers are running the same git SHA
 */
export async function GET() {
  const buildInfo = {
    ok: true,
    service: 'web',
    git_sha: process.env.NEXT_PUBLIC_GIT_SHA || 'unknown',
    build_time: process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown',
    brand_version: BRAND_VERSION,
    app_version: '6.2.0',
    time: new Date().toISOString(),
  };

  return NextResponse.json(buildInfo, {
    headers: {
      // Prevent caching - always return fresh data
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
