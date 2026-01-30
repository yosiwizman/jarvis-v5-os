/**
 * GET /api/notifications/stream
 * Server-Sent Events (SSE) endpoint for real-time notifications.
 * 
 * This endpoint provides:
 * - Connection confirmation message on connect
 * - Heartbeat pings every 15 seconds to keep connection alive
 * - Graceful handling of client disconnection
 * 
 * If the backend notification service is unavailable, this endpoint
 * still works as a keepalive stream for the client.
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const HEARTBEAT_INTERVAL = 15000; // 15 seconds

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send connection confirmation
      const connectionMessage = JSON.stringify({
        type: 'connection',
        id: `conn-${Date.now()}`,
        payload: { status: 'connected', timestamp: new Date().toISOString() },
        triggeredAt: new Date().toISOString()
      });
      controller.enqueue(encoder.encode(`data: ${connectionMessage}\n\n`));
      
      // Setup heartbeat interval
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = JSON.stringify({
            type: 'heartbeat',
            id: `hb-${Date.now()}`,
            payload: { timestamp: new Date().toISOString() },
            triggeredAt: new Date().toISOString()
          });
          controller.enqueue(encoder.encode(`data: ${heartbeat}\n\n`));
        } catch {
          // Stream closed, clear interval
          clearInterval(heartbeatInterval);
        }
      }, HEARTBEAT_INTERVAL);
      
      // Handle client disconnect via abort signal
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
