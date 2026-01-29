import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Consolidated health check endpoint for the display dashboard.
 * Proxies to the backend server health endpoint and adds web status.
 */
export async function GET() {
  const startTime = Date.now();
  
  let serverHealth = { ok: false, error: 'Not checked' };
  
  // Try to reach the backend server health endpoint
  try {
    const serverUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:1234';
    const response = await fetch(`${serverUrl}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      serverHealth = await response.json();
    } else {
      serverHealth = { ok: false, error: `Server returned ${response.status}` };
    }
  } catch (err) {
    serverHealth = { 
      ok: false, 
      error: err instanceof Error ? err.message : 'Server unreachable' 
    };
  }

  const responseTime = Date.now() - startTime;

  return NextResponse.json({
    ok: serverHealth.ok,
    timestamp: new Date().toISOString(),
    uptime: serverHealth.ok ? (serverHealth as { uptime?: number }).uptime : undefined,
    web: {
      ok: true,
      responseTimeMs: responseTime
    },
    server: serverHealth
  });
}
