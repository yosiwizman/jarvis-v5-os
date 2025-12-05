import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 0;

function sanitizeTargetUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid model URL');
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('Unsupported protocol for model URL');
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url');
  if (!target) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = sanitizeTargetUrl(target);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid model URL' },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'User-Agent': request.headers.get('user-agent') ?? 'JarvisModelProxy/1.0'
      }
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unable to fetch model' },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream request failed with status ${upstream.status}` },
      { status: upstream.status || 502 }
    );
  }

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') ?? 'application/octet-stream');
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) {
    headers.set('Content-Length', contentLength);
  }
  const disposition = upstream.headers.get('content-disposition');
  if (disposition) {
    headers.set('Content-Disposition', disposition);
  }
  headers.set('Cache-Control', 'public, max-age=60');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers
  });
}
