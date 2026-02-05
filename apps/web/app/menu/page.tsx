'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildServerUrl } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useSetupStatus } from '@/hooks/useSetupStatus';
import { BRAND, VOICE_ROUTE } from '@/lib/brand';

type KeysMeta = {
  openai?: { present: boolean };
  meshy?: { present: boolean };
};
type MenuCard = {
  href: string;
  title: string;
  desc: string;
  badge?: string;
  locked?: boolean; // Admin-only route when not logged in
};

// Admin-protected routes
const ADMIN_ROUTES = ['/setup', '/settings'];

const baseCards: MenuCard[] = [
  { href: VOICE_ROUTE, title: 'Voice Assistant', desc: `${BRAND.productName} realtime voice interface` },
  { href: '/3dmodel', title: '3D Model', desc: 'Create models from captured images' },
  { href: '/createimage', title: 'Create Image', desc: 'Generate images from prompts' },
  { href: '/3dprinters', title: '3D Printers', desc: 'Monitor and control Bambu Lab printers' },
  { href: '/files', title: 'Files', desc: 'Shared library of generated assets' },
  { href: '/chat', title: 'Chat', desc: 'Text chat with function calling' },
  { href: '/security', title: 'Security', desc: 'Live dashboard for connected cameras' },
  { href: '/camera', title: 'Camera', desc: 'Register a device as a camera client' },
  { href: '/holomat', title: 'Holomat', desc: 'Futuristic scanning interface with camera sync' },
  { href: '/settings', title: 'Settings', desc: `${BRAND.productName} system configuration` }
];

export default function MenuPage() {
  const router = useRouter();
  const { admin, pinConfigured, logout, loading: authLoading } = useAuth();
  const { setupRequired, llmConfigured, loading: setupLoading } = useSetupStatus();
  const [keysMeta, setKeysMeta] = useState<KeysMeta | null>(null);

  useEffect(() => {
    // Only fetch admin keys if setup is complete and user is admin
    if (setupRequired || !admin) {
      return;
    }
    
    let cancelled = false;
    fetch(buildServerUrl('/admin/keys/meta'), { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.meta) {
          setKeysMeta(data.meta as KeysMeta);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [setupRequired, admin]);

  const setupIncomplete = useMemo(() => {
    // Use setup status from hook instead of keys meta
    return setupRequired || !llmConfigured;
  }, [setupRequired, llmConfigured]);

  // Determine if admin routes should show locked
  const showLocked = pinConfigured && !admin;

  const handleLogout = async () => {
    await logout();
    router.refresh();
  };

  const cards = useMemo<MenuCard[]>(() => {
    const result: MenuCard[] = [];
    
    // Show Setup card when setup is incomplete OR when user is admin
    if (setupIncomplete || !pinConfigured) {
      result.push({
        href: '/setup',
        title: 'Setup Wizard',
        desc: 'Configure PIN, API keys, trust HTTPS, and complete onboarding.',
        badge: !pinConfigured ? 'First run' : 'Action required',
        locked: showLocked,
      });
    }
    
    // Add base cards with locked status for admin routes
    for (const card of baseCards) {
      result.push({
        ...card,
        locked: showLocked && ADMIN_ROUTES.includes(card.href),
      });
    }
    
    return result;
  }, [setupIncomplete, pinConfigured, showLocked]);

  return (
    <div className="space-y-6">
      {/* Admin Status Bar */}
      {pinConfigured && (
        <div className={`flex items-center justify-between p-3 rounded-lg ${
          admin 
            ? 'bg-emerald-500/10 border border-emerald-500/30' 
            : 'bg-white/5 border border-white/10'
        }`}>
          <div className="flex items-center gap-2">
            {admin ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm text-emerald-400">Admin unlocked</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-sm text-white/50">Admin locked</span>
              </>
            )}
          </div>
          {admin ? (
            <button
              onClick={handleLogout}
              className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login?next=/menu"
              className="text-xs px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 transition"
            >
              Admin Login
            </Link>
          )}
        </div>
      )}

      {/* Menu Cards */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link 
            key={card.href} 
            href={card.locked ? `/login?next=${card.href}` : card.href as any} 
            className={`card p-6 hover:border-[color:rgb(var(--jarvis-accent)_/_0.3)] transition block group ${
              card.locked ? 'opacity-75' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {card.locked && (
                  <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
                <div className="text-lg font-semibold group-hover:jarvis-accent-text transition">{card.title}</div>
              </div>
              {card.badge && (
                <span className="text-xs px-2 py-1 rounded-full border border-amber-500/40 text-amber-300 bg-amber-500/10">
                  {card.badge}
                </span>
              )}
            </div>
            <div className="mt-2 text-white/60">{card.desc}</div>
            <div className="mt-4 jarvis-accent-text font-medium">
              {card.locked ? 'Login to access →' : 'Go →'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
