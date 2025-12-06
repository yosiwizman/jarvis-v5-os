'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRootSocket } from '@/lib/socket';

export function NavigationBridge() {
  const router = useRouter();

  useEffect(() => {
    const socket = getRootSocket();
    if (!socket) return;

    const handler = (payload: { path?: string }) => {
      if (payload?.path) {
        router.push(payload.path as any);
      }
    };

    socket.on('ui:navigate', handler);
    return () => {
      socket.off('ui:navigate', handler);
    };
  }, [router]);

  return null;
}
