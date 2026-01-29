import { NextResponse } from 'next/server';

/**
 * GET /api/system/metrics
 * Proxies system metrics from the backend server.
 * Returns CPU, memory, and uptime information for the display dashboard.
 */
export async function GET() {
  try {
    const serverUrl = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:1234';
    const response = await fetch(`${serverUrl}/system/metrics`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Server returned ${response.status}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Return sanitized metrics (no secrets)
    return NextResponse.json({
      cpuLoad: data.cpuLoad,
      memoryUsedPct: data.memoryUsedPct,
      memoryUsedGB: data.memoryUsedGB,
      memoryTotalGB: data.memoryTotalGB,
      uptime: data.uptime,
      timestamp: data.timestamp || new Date().toISOString()
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch metrics' },
      { status: 502 }
    );
  }
}
