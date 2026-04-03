"use client";

import { AkiorLogo } from "./AkiorLogo";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg" | "xl" | "icon";
  showTagline?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { svgSize: 80, textClass: "text-lg", subtitleClass: "text-[8px]" },
  md: { svgSize: 140, textClass: "text-2xl", subtitleClass: "text-[10px]" },
  lg: { svgSize: 220, textClass: "text-4xl", subtitleClass: "text-xs" },
  xl: { svgSize: 360, textClass: "text-6xl", subtitleClass: "text-sm" },
  icon: { svgSize: 100, textClass: "text-xl", subtitleClass: "text-[6px]" },
};

/**
 * Dynamic AKIOR brand mark component — sacred geometry logo
 */
export function BrandMark({
  size = "lg",
  showTagline = true,
  className = "",
}: BrandMarkProps) {
  const config = sizeConfig[size];

  return (
    <AkiorLogo
      size={config.svgSize}
      showText={showTagline}
      textClass={config.textClass}
      subtitleClass={config.subtitleClass}
      className={className}
    />
  );
}

/**
 * Compact brand mark for small spaces (e.g., floating icon)
 */
export function BrandMarkCompact({ className = "" }: { className?: string }) {
  return (
    <AkiorLogo
      size={80}
      showText={true}
      showActivateLabel={true}
      textClass="text-lg"
      subtitleClass="text-[5px]"
      className={className}
    />
  );
}

/**
 * Large brand mark for center of HUD (popup assistant view)
 */
export function BrandMarkHUD({ className = "" }: { className?: string }) {
  return (
    <AkiorLogo
      size={300}
      showText={true}
      textClass="text-5xl"
      subtitleClass="text-sm"
      className={className}
    />
  );
}
