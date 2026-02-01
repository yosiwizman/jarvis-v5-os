'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { buildServerUrl } from '@/lib/api';
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
};

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
  const [keysMeta, setKeysMeta] = useState<KeysMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(buildServerUrl('/admin/keys/meta'))
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
  }, [buildServerUrl]);

  const setupIncomplete = useMemo(() => {
    if (!keysMeta) return false;
    return !keysMeta.openai?.present || !keysMeta.meshy?.present;
  }, [keysMeta]);

  const cards = useMemo<MenuCard[]>(() => {
    // Only show Setup card when keys are missing
    if (setupIncomplete) {
      return [
        {
          href: '/settings#provider-keys',
          title: 'Setup',
          desc: 'Configure API keys and complete onboarding.',
          badge: 'Not configured'
        },
        ...baseCards
      ];
    }
    return baseCards;
  }, [setupIncomplete]);

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <Link key={card.href} href={card.href as any} className="card p-6 hover:border-[color:rgb(var(--jarvis-accent)_/_0.3)] transition block group">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold group-hover:jarvis-accent-text transition">{card.title}</div>
            {card.badge && (
              <span className="text-xs px-2 py-1 rounded-full border border-amber-500/40 text-amber-300 bg-amber-500/10">
                {card.badge}
              </span>
            )}
          </div>
          <div className="mt-2 text-white/60">{card.desc}</div>
          <div className="mt-4 jarvis-accent-text font-medium">Go →</div>
        </Link>
      ))}
    </div>
  );
}
