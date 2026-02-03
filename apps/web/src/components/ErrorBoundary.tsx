'use client';

import React, { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

/**
 * Generate a short error ID from error message for tracking
 */
function generateErrorId(error: Error): string {
  const str = `${error.name}:${error.message}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 8).toUpperCase();
}

/**
 * Global Error Boundary
 * 
 * Catches React errors and displays a fallback UI with:
 * - Build stamp (git SHA, build time)
 * - Error ID for tracking
 * - Link to /api/health/build for debugging
 * 
 * Does NOT log secrets - only error name, message, and component stack.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorId = generateErrorId(error);
    return { 
      hasError: true, 
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error safely (no secrets) - useful for debugging
    console.error('[ErrorBoundary] Application error caught:', {
      errorId: this.state.errorId,
      name: error.name,
      message: error.message,
      componentStack: errorInfo.componentStack?.slice(0, 500), // Limit stack size
      gitSha: process.env.NEXT_PUBLIC_GIT_SHA || 'unknown',
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown',
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorId: null });
    // Optionally reload the page for a clean slate
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Build info from environment
      const gitSha = process.env.NEXT_PUBLIC_GIT_SHA || 'unknown';
      const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown';

      // Format build time
      let formattedTime = buildTime;
      if (buildTime !== 'unknown') {
        try {
          const date = new Date(buildTime);
          formattedTime = date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch {
          // Keep original
        }
      }

      return (
        <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center p-8">
          <div className="max-w-lg w-full space-y-6">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <div className="text-center space-y-2">
              <h1 className="text-xl font-semibold text-white">Application Error</h1>
              <p className="text-white/60">
                Something went wrong. This may be due to a stale build, network issue, or application bug.
              </p>
            </div>

            {/* Error Details Card */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
              {/* Error ID */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/50">Error ID</span>
                <code className="text-xs font-mono text-amber-400">{this.state.errorId}</code>
              </div>

              {/* Error Message */}
              <div className="space-y-1">
                <span className="text-xs text-white/50">Error</span>
                <div className="bg-black/40 rounded-lg p-2 font-mono text-xs text-red-300 overflow-x-auto">
                  {this.state.error?.message || 'Unknown error'}
                </div>
              </div>

              {/* Build Info */}
              <div className="border-t border-white/10 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/50">Build SHA</span>
                  <code className="text-xs font-mono text-cyan-400" data-testid="error-build-sha">{gitSha}</code>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/50">Build Time</span>
                  <code className="text-xs font-mono text-white/70">{formattedTime}</code>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = '/menu';
                  }
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
              >
                Back to Menu
              </button>
              <a
                href="/api/health/build"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-colors text-center"
              >
                Check Build Info
              </a>
            </div>

            {/* Help Text */}
            <p className="text-xs text-white/40 text-center">
              If this error persists after reloading, the deployment may need to be refreshed.
              Compare the SHA above with <code className="text-cyan-400/70">/api/health/build</code> to verify.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
