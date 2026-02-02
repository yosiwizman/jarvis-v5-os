'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BRAND } from '@/lib/brand';
import { useAuth } from '@/hooks/useAuth';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { admin, pinConfigured, loading: authLoading, login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);

  // Get redirect destination from query params
  const nextUrl = searchParams.get('next') || '/menu';

  // If already admin, redirect to destination
  useEffect(() => {
    if (!authLoading && admin) {
      router.replace(nextUrl as any);
    }
  }, [admin, authLoading, router, nextUrl]);

  // If PIN not configured, redirect to setup
  useEffect(() => {
    if (!authLoading && !pinConfigured) {
      router.replace('/setup' as any);
    }
  }, [pinConfigured, authLoading, router]);

  const handleQuickAccess = () => {
    // Quick access goes to menu without admin privileges
    router.push('/menu');
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await login(accessCode);
    
    if (result.ok) {
      router.push(nextUrl as any);
    } else {
      setError(result.error || 'Invalid PIN');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'url(/assets/hex.png)',
          backgroundSize: '30%',
          backgroundPosition: 'center',
          backgroundRepeat: 'repeat'
        }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-transparent to-blue-900/20" />
      
      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="card p-8 space-y-8 backdrop-blur-xl bg-black/40 border border-cyan-500/20 shadow-[0_0_60px_rgba(34,211,238,0.15)]">
          
          {/* Logo Section */}
          <div className="text-center space-y-4">
            <div className="relative inline-block py-4">
              {/* Glow Effect */}
              <div className="absolute inset-0 blur-2xl bg-cyan-500/20 rounded-full scale-150" />
              
              {/* Brand Mark */}
              <div className="relative" data-testid="brand-mark">
                <div 
                  className="text-4xl font-bold tracking-[0.3em] text-cyan-400"
                  style={{ 
                    textShadow: '0 0 20px rgba(34, 211, 238, 0.6), 0 0 40px rgba(34, 211, 238, 0.3)',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}
                >
                  {BRAND.productName}
                </div>
                <div 
                  className="text-[10px] tracking-[0.15em] text-cyan-400/70 uppercase text-center leading-tight mt-2"
                  style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
                >
                  Advanced Knowledge Intelligence
                  <br />
                  Operating Resource
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
            <span className="text-xs text-white/30 uppercase tracking-widest">Access</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
          </div>

          {/* Access Options */}
          {!showCodeInput ? (
            <div className="space-y-4">
              <button
                onClick={handleQuickAccess}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 text-white font-medium transition-all duration-300 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Quick Access</span>
                </div>
              </button>

              <button
                onClick={() => setShowCodeInput(true)}
                className="w-full py-3 px-6 rounded-xl border border-white/10 hover:border-cyan-500/50 text-white/70 hover:text-white font-medium transition-all duration-300 hover:bg-white/5"
              >
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>Admin Login (PIN)</span>
                </div>
              </button>
              <p className="text-xs text-white/40 text-center">
                Quick Access for regular use. Admin Login to access Setup & Settings.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-white/60">Owner PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="••••"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all text-center font-mono text-lg tracking-widest"
                />
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center">{error}</div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCodeInput(false);
                    setError(null);
                    setAccessCode('');
                  }}
                  className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:border-white/20 text-white/60 hover:text-white transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !accessCode}
                  className="flex-1 py-3 px-4 rounded-xl bg-cyan-600/80 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600/80 text-white font-medium transition-all"
                >
                  {isLoading ? 'Verifying...' : 'Unlock'}
                </button>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-white/30 pt-4">
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
              <span>System Online</span>
            </div>
          </div>
        </div>

        {/* Version Badge */}
        <div className="text-center mt-6 text-xs text-white/20">
          AKIOR Console v6.2
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/40">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
