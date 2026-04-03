"use client";

import AkiorCore from "./akior/AkiorCore";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg" | "xl" | "icon";
  showTagline?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { svgSize: 80 },
  md: { svgSize: 140 },
  lg: { svgSize: 220 },
  xl: { svgSize: 360 },
  icon: { svgSize: 100 },
};

/**
 * Dynamic AKIOR brand mark component — production orb renderer
 */
export function BrandMark({ size = "lg", className = "" }: BrandMarkProps) {
  const config = sizeConfig[size];

  return <AkiorCore state="idle" size={config.svgSize} className={className} />;
}

/**
 * Compact brand mark for small spaces (e.g., floating icon)
 */
export function BrandMarkCompact({ className = "" }: { className?: string }) {
  return <AkiorCore state="idle" size={80} className={className} />;
}

/**
 * Large brand mark for center of HUD (popup assistant view)
 */
export function BrandMarkHUD({ className = "" }: { className?: string }) {
  return <AkiorCore state="idle" size={300} className={className} />;
}
