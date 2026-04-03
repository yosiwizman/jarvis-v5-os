"use client";

/**
 * AkiorLogo — Sacred geometry SVG logo based on the owner's daughter's design.
 *
 * Static state: concentric circles, hexagram (Star of David), inner triangles,
 * central glowing orb, floating particles.  All in cyan (#00D4FF) on dark (#0A0A0F).
 *
 * Voice-active state (className includes "voice-active"): horizontal waveform
 * pulses emanating from centre.
 */

import { BRAND } from "@/lib/brand";

interface AkiorLogoProps {
  /** Pixel width & height of the SVG viewport */
  size?: number;
  /** Show AKIOR text + subtitle below the geometry */
  showText?: boolean;
  /** Extra class names — include "voice-active" to trigger waveform animation */
  className?: string;
  /** Show the compact "Click to Activate" label (for floating badge) */
  showActivateLabel?: boolean;
  /** Text size override for the AKIOR title */
  textClass?: string;
  /** Text size override for the subtitle */
  subtitleClass?: string;
}

export function AkiorLogo({
  size = 280,
  showText = true,
  className = "",
  showActivateLabel = false,
  textClass = "text-4xl",
  subtitleClass = "text-[10px]",
}: AkiorLogoProps) {
  const cx = 200;
  const cy = 200;
  const isVoiceActive = className.includes("voice-active");

  return (
    <div
      className={`akior-logo-wrapper flex flex-col items-center justify-center gap-2 ${className}`}
    >
      <div
        className="akior-logo-svg relative"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 400 400"
          width={size}
          height={size}
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          <defs>
            {/* Radial glow for the centre orb */}
            <radialGradient id="akior-orb-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00D4FF" stopOpacity="1" />
              <stop offset="40%" stopColor="#00D4FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
            </radialGradient>

            {/* Outer ring gradient */}
            <radialGradient id="akior-ring-glow" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="#00D4FF" stopOpacity="0" />
              <stop offset="90%" stopColor="#00D4FF" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
            </radialGradient>

            {/* Filter for the soft glow */}
            <filter
              id="akior-glow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="4"
                result="blur"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter
              id="akior-glow-strong"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="8"
                result="blur"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ---- BACKGROUND CIRCLE (outermost faint ring) ---- */}
          <circle
            cx={cx}
            cy={cy}
            r={185}
            fill="none"
            stroke="#00D4FF"
            strokeWidth="0.5"
            opacity="0.15"
            className="akior-outer-ring"
          />

          {/* ---- OUTER CIRCLE ---- */}
          <circle
            cx={cx}
            cy={cy}
            r={170}
            fill="none"
            stroke="#00D4FF"
            strokeWidth="1"
            opacity="0.3"
            className="akior-outer-ring"
          />

          {/* ---- SECOND CIRCLE ---- */}
          <circle
            cx={cx}
            cy={cy}
            r={150}
            fill="none"
            stroke="#00D4FF"
            strokeWidth="0.8"
            opacity="0.25"
            className="akior-mid-ring"
          />

          {/* ---- OUTER HEXAGRAM (Star of David) ---- */}
          {(() => {
            const r = 140;
            // Triangle pointing up
            const upPoints = [0, 1, 2]
              .map((i) => {
                const angle = (i * 120 - 90) * (Math.PI / 180);
                return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
              })
              .join(" ");
            // Triangle pointing down
            const downPoints = [0, 1, 2]
              .map((i) => {
                const angle = (i * 120 + 30) * (Math.PI / 180);
                return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
              })
              .join(" ");

            return (
              <g className="akior-star" filter="url(#akior-glow)">
                <polygon
                  points={upPoints}
                  fill="none"
                  stroke="#00D4FF"
                  strokeWidth="1.2"
                  opacity="0.6"
                />
                <polygon
                  points={downPoints}
                  fill="none"
                  stroke="#00D4FF"
                  strokeWidth="1.2"
                  opacity="0.6"
                />
              </g>
            );
          })()}

          {/* ---- INNER HEXAGRAM (smaller, rotated slightly) ---- */}
          {(() => {
            const r = 90;
            const upPoints = [0, 1, 2]
              .map((i) => {
                const angle = (i * 120 - 90) * (Math.PI / 180);
                return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
              })
              .join(" ");
            const downPoints = [0, 1, 2]
              .map((i) => {
                const angle = (i * 120 + 30) * (Math.PI / 180);
                return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
              })
              .join(" ");

            return (
              <g className="akior-inner-star" filter="url(#akior-glow)">
                <polygon
                  points={upPoints}
                  fill="none"
                  stroke="#00D4FF"
                  strokeWidth="1"
                  opacity="0.45"
                />
                <polygon
                  points={downPoints}
                  fill="none"
                  stroke="#00D4FF"
                  strokeWidth="1"
                  opacity="0.45"
                />
              </g>
            );
          })()}

          {/* ---- HEXAGONAL FRAME (connecting the star tips) ---- */}
          {(() => {
            const r = 140;
            const hexPoints = [0, 1, 2, 3, 4, 5]
              .map((i) => {
                const angle = (i * 60 - 90) * (Math.PI / 180);
                return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
              })
              .join(" ");

            return (
              <polygon
                points={hexPoints}
                fill="none"
                stroke="#00D4FF"
                strokeWidth="0.8"
                opacity="0.2"
              />
            );
          })()}

          {/* ---- INNER CIRCLE (around the orb) ---- */}
          <circle
            cx={cx}
            cy={cy}
            r={55}
            fill="none"
            stroke="#00D4FF"
            strokeWidth="0.8"
            opacity="0.35"
          />

          {/* ---- INNERMOST CIRCLE ---- */}
          <circle
            cx={cx}
            cy={cy}
            r={35}
            fill="none"
            stroke="#00D4FF"
            strokeWidth="0.6"
            opacity="0.3"
          />

          {/* ---- CENTRE ORB ---- */}
          <circle
            cx={cx}
            cy={cy}
            r={18}
            fill="url(#akior-orb-glow)"
            className="akior-orb"
            filter="url(#akior-glow-strong)"
          />
          {/* Hard-bright core */}
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill="#00D4FF"
            opacity="0.9"
            className="akior-orb-core"
          />

          {/* ---- CONNECTING LINES (star-tip to centre) ---- */}
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const angle = deg * (Math.PI / 180);
            const x2 = cx + 140 * Math.cos(angle - Math.PI / 2);
            const y2 = cy + 140 * Math.sin(angle - Math.PI / 2);
            return (
              <line
                key={deg}
                x1={cx}
                y1={cy}
                x2={x2}
                y2={y2}
                stroke="#00D4FF"
                strokeWidth="0.4"
                opacity="0.15"
              />
            );
          })}

          {/* ---- PARTICLES (small dots scattered around) ---- */}
          {[
            { x: 45, y: 60, r: 1.5, delay: 0 },
            { x: 340, y: 80, r: 1, delay: 1 },
            { x: 370, y: 300, r: 1.8, delay: 2 },
            { x: 30, y: 320, r: 1.2, delay: 0.5 },
            { x: 100, y: 30, r: 1, delay: 1.5 },
            { x: 300, y: 370, r: 1.3, delay: 3 },
            { x: 60, y: 200, r: 0.8, delay: 2.5 },
            { x: 350, y: 180, r: 1.1, delay: 0.8 },
            { x: 180, y: 380, r: 0.9, delay: 1.2 },
            { x: 220, y: 20, r: 1.4, delay: 2.8 },
            { x: 15, y: 140, r: 0.7, delay: 3.5 },
            { x: 385, y: 250, r: 1.0, delay: 1.8 },
          ].map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill="#00D4FF"
              className="akior-particle"
              style={{ animationDelay: `${p.delay}s` }}
            />
          ))}

          {/* ---- VOICE-ACTIVE WAVEFORM LINES ---- */}
          {isVoiceActive && (
            <g className="akior-waveform">
              {/* Horizontal waveform bars emanating from centre */}
              {Array.from({ length: 20 }).map((_, i) => {
                const offset = (i + 1) * 12;
                const barHeight = 3 + Math.random() * 6;
                return (
                  <g key={`wave-${i}`}>
                    {/* Right side */}
                    <rect
                      x={cx + 25 + offset}
                      y={cy - barHeight / 2}
                      width={4}
                      height={barHeight}
                      fill="#00D4FF"
                      rx={2}
                      className="akior-wave-bar"
                      style={{ animationDelay: `${i * 0.05}s` }}
                    />
                    {/* Left side */}
                    <rect
                      x={cx - 29 - offset}
                      y={cy - barHeight / 2}
                      width={4}
                      height={barHeight}
                      fill="#00D4FF"
                      rx={2}
                      className="akior-wave-bar"
                      style={{ animationDelay: `${i * 0.05 + 0.02}s` }}
                    />
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>

      {/* ---- TEXT ---- */}
      {showText && (
        <div className="flex flex-col items-center gap-1">
          <div
            className={`${textClass} font-bold tracking-[0.3em] text-cyan-400`}
            style={{
              textShadow:
                "0 0 20px rgba(0, 212, 255, 0.6), 0 0 40px rgba(0, 212, 255, 0.3)",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {BRAND.productName}
          </div>
          <div
            className={`${subtitleClass} tracking-[0.15em] text-cyan-400/70 uppercase text-center leading-tight`}
            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            Advanced Knowledge Intelligence
            <br />
            Operating Resource
          </div>
          {showActivateLabel && (
            <div
              className="text-[6px] tracking-[0.15em] text-cyan-400/80 uppercase mt-1"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              Click to Activate
            </div>
          )}
        </div>
      )}
    </div>
  );
}
