/**
 * Builds a server URL using same-origin pattern.
 * The dev proxy (dev-proxy.mjs) routes /api and /socket.io to the backend.
 * This ensures consistent behavior across all devices accessing the same host.
 */
export function buildServerUrl(path: string): string {
  // If already an absolute URL, return as-is
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // Prefix with /api unless it's already a special path
  const shouldPrefix =
    cleanPath !== '/api' &&
    !cleanPath.startsWith('/api/') &&
    !cleanPath.startsWith('/files/') &&
    !cleanPath.startsWith('/static/') &&
    !cleanPath.startsWith('/socket.io/');
  
  return shouldPrefix ? `/api${cleanPath}` : cleanPath;
}
