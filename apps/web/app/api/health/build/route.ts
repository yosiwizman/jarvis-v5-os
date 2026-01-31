import { NextResponse } from 'next/server';

/**
 * GET /api/health/build
 * Returns build information for deployment drift detection.
 * This endpoint is always available and returns static build-time values.
 * 
 * Use this to:
 * - Verify which build is currently deployed
 * - Debug deployment drift (stale HTML/JS serving)
 * - Compare UI-displayed SHA with actual running build
 */
export async function GET() {
  const buildInfo = {
    ok: true,
    git_sha: process.env.NEXT_PUBLIC_GIT_SHA || 'unknown',
    build_time: process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown',
    app_version: process.env.npm_package_version || '6.2.0',
    env: {
      // Include only non-sensitive env vars useful for debugging
      node_env: process.env.NODE_ENV || 'unknown',
      disable_https: process.env.NEXT_PUBLIC_DISABLE_HTTPS === 'true',
      backend_url: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:1234',
      kiosk_mode: process.env.NEXT_PUBLIC_JARVIS_UBUNTU_MODE === 'kiosk',
    },
    time: new Date().toISOString(),
  };

  return NextResponse.json(buildInfo, {
    headers: {
      // Prevent caching of this endpoint - always return fresh data
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
