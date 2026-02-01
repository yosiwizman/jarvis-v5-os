'use client';

import { BRAND } from '@/lib/brand';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  showTagline?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { text: 'text-lg', tagline: 'text-[8px]', gap: 'gap-0.5', container: 'w-16 h-16' },
  md: { text: 'text-2xl', tagline: 'text-[10px]', gap: 'gap-1', container: 'w-24 h-24' },
  lg: { text: 'text-4xl', tagline: 'text-xs', gap: 'gap-1.5', container: 'w-40 h-40' },
  xl: { text: 'text-6xl', tagline: 'text-sm', gap: 'gap-2', container: 'w-72 h-72' },
  icon: { text: 'text-xl', tagline: 'text-[6px]', gap: 'gap-0.5', container: 'w-20 h-20' },
};

/**
 * Dynamic AKIOR brand mark component
 * Replaces static logo.png to avoid hardcoded J.A.R.V.I.S. text
 */
export function BrandMark({ size = 'lg', showTagline = true, className = '' }: BrandMarkProps) {
  const config = sizeConfig[size];
  
  return (
    <div className={`flex flex-col items-center justify-center ${config.gap} ${className}`}>
      <div 
        className={`${config.text} font-bold tracking-[0.3em] text-cyan-400`}
        style={{ 
          textShadow: '0 0 20px rgba(34, 211, 238, 0.6), 0 0 40px rgba(34, 211, 238, 0.3)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {BRAND.productName}
      </div>
      {showTagline && (
        <div 
          className={`${config.tagline} tracking-[0.15em] text-cyan-400/70 uppercase text-center leading-tight`}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          Advanced Knowledge Intelligence
          <br />
          Operating Resource
        </div>
      )}
    </div>
  );
}

/**
 * Compact brand mark for small spaces (e.g., floating icon)
 */
export function BrandMarkCompact({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div 
        className="text-lg font-bold tracking-[0.2em] text-cyan-400"
        style={{ 
          textShadow: '0 0 15px rgba(34, 211, 238, 0.8)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {BRAND.productName}
      </div>
      <div 
        className="text-[5px] tracking-[0.1em] text-cyan-400/60 uppercase text-center leading-tight mt-0.5"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        Advanced Knowledge Intelligence
        <br />
        Operating Resource
      </div>
      <div 
        className="text-[6px] tracking-[0.15em] text-cyan-400/80 uppercase mt-1"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        Click to Activate
      </div>
    </div>
  );
}

/**
 * Large brand mark for center of HUD (popup assistant view)
 */
export function BrandMarkHUD({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div 
        className="text-5xl font-bold tracking-[0.3em] text-cyan-400"
        style={{ 
          textShadow: '0 0 30px rgba(34, 211, 238, 0.8), 0 0 60px rgba(34, 211, 238, 0.4)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {BRAND.productName}
      </div>
      <div 
        className="text-sm tracking-[0.2em] text-cyan-400/70 uppercase text-center leading-relaxed mt-2"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        Advanced Knowledge Intelligence
        <br />
        Operating Resource
      </div>
    </div>
  );
}
