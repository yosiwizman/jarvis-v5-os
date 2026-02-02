/**
 * Admin Route Protection Middleware
 * 
 * Protects admin-only routes based on PIN configuration and session state.
 * 
 * Routes protected:
 * - /setup - unless PIN not configured (first-run)
 * - /settings
 * - /diagnostics (optional - currently public for debugging)
 * 
 * Note: /api/admin/* routes are protected by the backend server directly.
 * 
 * SECURITY:
 * - Checks session cookie validity
 * - Allows first-run /setup access when PIN not configured
 */

import { NextRequest, NextResponse } from 'next/server';

// Routes that require admin authentication
const ADMIN_ROUTES = ['/setup', '/settings'];

// Session cookie name (must match server)
const SESSION_COOKIE_NAME = 'akior_admin_session';

/**
 * Check auth state by calling backend API
 * 
 * Note: This calls the backend through Next.js rewrites.
 * In production, ensure this doesn't cause circular dependencies.
 */
async function getAuthState(request: NextRequest): Promise<{ admin: boolean; pinConfigured: boolean }> {
  try {
    // Build the URL for the auth/me endpoint
    // Use request URL as base to ensure proper routing
    const url = new URL('/api/auth/me', request.url);
    
    // Forward cookies to backend
    const response = await fetch(url.toString(), {
      headers: {
        cookie: request.headers.get('cookie') || '',
      },
      // Don't follow redirects, we just want the JSON response
      redirect: 'manual',
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        admin: Boolean(data.admin),
        pinConfigured: Boolean(data.pinConfigured),
      };
    }
  } catch (error) {
    // If fetch fails (e.g., server not running), assume not configured
    console.error('[Middleware] Failed to check auth state:', error);
  }
  
  return { admin: false, pinConfigured: false };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Only process admin routes
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
  
  if (!isAdminRoute) {
    return NextResponse.next();
  }
  
  // Check auth state from backend
  const { admin, pinConfigured } = await getAuthState(request);
  
  // First-run scenario: allow /setup access when PIN not configured
  if (pathname.startsWith('/setup') && !pinConfigured) {
    return NextResponse.next();
  }
  
  // If PIN configured but not admin, redirect to login
  if (!admin) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Admin authenticated, allow access
  return NextResponse.next();
}

export const config = {
  // Match admin routes that need protection
  // Note: This doesn't include /api/admin/* as those are protected by backend
  matcher: ['/setup', '/setup/:path*', '/settings', '/settings/:path*'],
};
