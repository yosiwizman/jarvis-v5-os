'use client';

import './globals.css';
import Link from 'next/link';
import { NavigationBridge } from '@/components/navigation-bridge';
import { JarvisAssistant, JarvisIcon } from '@/components/JarvisAssistant';
import { HudWidget } from '@/components/HudWidget';
import { ThemeProvider } from '@/context/ThemeContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { NotificationToast } from '@/components/NotificationToast';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { loadSettingsFromServer } from '@shared/settings';

// Note: metadata must be exported from a Server Component, not a Client Component
// If you need metadata, create a separate server layout wrapper

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isJarvisOpen, setIsJarvisOpen] = useState(false);
  const pathname = usePathname();

  // Load settings from server on app mount
  useEffect(() => {
    loadSettingsFromServer().catch(err => {
      console.error('Failed to load settings from server:', err);
    });
  }, []);

  // Don't show floating icon on the dedicated Jarvis page
  const showFloatingJarvis = pathname !== '/jarvis';

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen relative">
        <ThemeProvider>
          <NotificationProvider>
          <aside className={`h-screen fixed top-0 left-0 p-4 card flex flex-col overflow-hidden z-50 transition-transform duration-300 ${isCollapsed ? '-translate-x-full' : 'translate-x-0'} w-[260px]`}>
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="btn p-2 min-w-0"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              ☰
            </button>
            {!isCollapsed && <div className="text-xl font-semibold">Jarvis</div>}
          </div>
          <nav className="space-y-2 flex-1">
            <Link className={`block btn truncate ${pathname === '/menu' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/menu" title="Menu">
              {isCollapsed ? 'M' : 'Menu'}
            </Link>
            <Link className={`block btn truncate ${pathname === '/jarvis' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/jarvis" title="Jarvis">
              {isCollapsed ? 'J' : 'Jarvis'}
            </Link>
            <Link className={`block btn truncate ${pathname === '/3dmodel' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/3dmodel" title="3D Model">
              {isCollapsed ? '3D' : '3D Model'}
            </Link>
            <Link className={`block btn truncate ${pathname === '/3dViewer' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/3dViewer" title="3D Viewer">
              {isCollapsed ? '3V' : '3D Viewer'}
            </Link>
            <Link className={`block btn truncate ${pathname === '/createimage' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/createimage" title="Create Image">
              {isCollapsed ? 'I' : 'Create Image'}
            </Link>
            <Link className={`block btn truncate ${pathname === '/3dprinters' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/3dprinters" title="3D Printers">
              {isCollapsed ? '3P' : '3D Printers'}
            </Link>
            <Link className={`block btn truncate ${pathname === '/files' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/files" title="Files">
              {isCollapsed ? 'F' : 'Files'}
            </Link>
            <Link className={`block btn truncate ${pathname === '/chat' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/chat" title="Chat">
              {isCollapsed ? 'C' : 'Chat'}
            </Link>
            <Link className={`block btn truncate ${pathname === '/security' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/security" title="Security">
              {isCollapsed ? 'S' : 'Security'}
            </Link>
            <Link className={`block btn truncate ${pathname === '/camera' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/camera" title="Camera">
              {isCollapsed ? 'Ca' : 'Camera'}
            </Link>
            {/* Expose Holomat apps deck explicitly in the sidebar (adds UI route without changing existing links) */}
            <Link className={`block btn truncate ${pathname === '/holomat' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/holomat" title="Holomat">
              {isCollapsed ? 'Ho' : 'Holomat'}
            </Link>
            <Link className={`block btn truncate ${pathname === '/functions' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/functions" title="Functions">
              {isCollapsed ? 'Fn' : 'Functions'}
            </Link>
            <Link className={`block btn truncate ${pathname === '/settings' ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border-l-2 border-l-[color:rgb(var(--jarvis-accent))] jarvis-accent-text' : ''}`} href="/settings" title="Settings">
              {isCollapsed ? 'Se' : 'Settings'}
            </Link>
          </nav>
          {!isCollapsed && <footer className="mt-6 text-xs text-white/50">dark • modern</footer>}
        </aside>
        
        {/* Floating menu button when sidebar is hidden */}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="fixed top-4 left-4 z-40 btn p-3 shadow-lg"
            title="Show menu"
          >
            ☰
          </button>
        )}
        
        <main className={`relative p-8 space-y-6 transition-all duration-300 ${isCollapsed ? 'ml-0' : 'ml-[260px]'}`}>
          <NavigationBridge />
          {children}
        </main>
        
          {/* HUD Widget - System Status (V3 inspired) */}
          <HudWidget />
        
          {/* Global Jarvis Assistant */}
          {showFloatingJarvis && (
            <>
              <JarvisIcon onClick={() => setIsJarvisOpen(true)} />
              <JarvisAssistant isOpen={isJarvisOpen} onClose={() => setIsJarvisOpen(false)} />
            </>
          )}
          
          {/* Global Notification Toast */}
          <NotificationToast />
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
