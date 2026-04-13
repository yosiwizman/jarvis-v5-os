'use client';

import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';

/**
 * Banner that appears when running over HTTP (insecure context).
 * Warns users that camera/mic features won't work.
 */
export function InsecureBanner() {
  const [isInsecure, setIsInsecure] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const host = window.location.hostname;
    const isIpHost = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const secure = window.isSecureContext;

    setIsInsecure(!secure || isIpHost);

    // Check if user has dismissed this before (session only)
    const wasDismissed = sessionStorage.getItem('akior.insecureBannerDismissed');
    if (wasDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('akior.insecureBannerDismissed', 'true');
    }
  };

  const targetUrl = BRAND.canonicalUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // Don't show if secure or dismissed
  if (!isInsecure || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500/95 text-black px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-medium">
            <strong>Secure LAN Access</strong> — For camera/mic and full functionality, use{' '}
            <a href={targetUrl} className="underline hover:no-underline">
              {targetUrl}
            </a>.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-2 py-1 text-xs font-semibold bg-black/10 hover:bg-black/20 rounded"
            title="Copy https://akior.local"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-black/10 rounded transition-colors"
            title="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
