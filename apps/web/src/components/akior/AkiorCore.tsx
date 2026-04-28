"use client";
import React, { useEffect, useRef } from "react";

export type AkiorState = "idle" | "listening" | "speaking" | "thinking";

/**
 * Surface recipe system. Each surface declares its own layer set + density.
 * Fullscreen is the reference composition (/jarvis). Embedded surfaces reduce
 * density but retain the full motion language (particles, rings×2, beam, waveform).
 */
export type AkiorSurface =
  | "fullscreen"
  | "login-idle"
  | "assistant-standby"
  | "assistant-active";

/** @deprecated legacy two-value prop. Use `surface` instead. */
export type AkiorMode = "full" | "compact";

export interface AkiorCoreProps {
  state?: AkiorState;
  size?: number | string;
  className?: string;
  audioLevel?: number;
  reducedMotion?: boolean;
  /** New surface-driven recipe selector. Defaults to "fullscreen" for safety. */
  surface?: AkiorSurface;
  /** @deprecated. Kept for back-compat: "full" → fullscreen, "compact" → assistant-standby. */
  mode?: AkiorMode;
}

interface Recipe {
  showBgCanvas: boolean;
  bgDensity: number; // 0..1 scales particle/orb/dust counts
  showSecondRing: boolean;
  showBeam: boolean;
  showFxCanvas: boolean;
  fxIntensity: number; // 0..1 waveform amplitude multiplier
  showWordmark: boolean;
  showVignette: boolean;
  audioReactive: boolean;
  bgRadialGradient: boolean; // fullscreen panel gradient background
  beamOpacity: number;
  emblemGlow: string;
  coreGlow: string;
}

const RECIPES: Record<AkiorSurface, Recipe> = {
  fullscreen: {
    showBgCanvas: true,
    bgDensity: 1,
    showSecondRing: true,
    showBeam: true,
    showFxCanvas: true,
    fxIntensity: 1,
    showWordmark: true,
    showVignette: true,
    audioReactive: true,
    bgRadialGradient: true,
    beamOpacity: 0.95,
    emblemGlow:
      "drop-shadow(0 0 3px rgba(99,246,255,.95)) drop-shadow(0 0 10px rgba(99,246,255,.70)) drop-shadow(0 0 26px rgba(99,246,255,.34))",
    coreGlow:
      "drop-shadow(0 0 18px rgba(99,246,255,.5)) drop-shadow(0 0 36px rgba(99,246,255,.38))",
  },
  "login-idle": {
    showBgCanvas: true,
    bgDensity: 0.45,
    showSecondRing: true,
    showBeam: true,
    showFxCanvas: true,
    fxIntensity: 0.4,
    showWordmark: false, // login keeps its own DOM wordmark below
    showVignette: true,
    audioReactive: false,
    bgRadialGradient: false,
    beamOpacity: 0.82,
    emblemGlow:
      "drop-shadow(0 0 4px rgba(99,246,255,.85)) drop-shadow(0 0 12px rgba(99,246,255,.5)) drop-shadow(0 0 22px rgba(99,246,255,.28))",
    coreGlow:
      "drop-shadow(0 0 12px rgba(99,246,255,.5)) drop-shadow(0 0 24px rgba(99,246,255,.3))",
  },
  "assistant-standby": {
    showBgCanvas: true,
    bgDensity: 0.45,
    showSecondRing: true,
    showBeam: true,
    showFxCanvas: true,
    fxIntensity: 0.35,
    showWordmark: false,
    showVignette: true,
    audioReactive: false,
    bgRadialGradient: false,
    beamOpacity: 0.8,
    emblemGlow:
      "drop-shadow(0 0 4px rgba(99,246,255,.9)) drop-shadow(0 0 14px rgba(99,246,255,.55)) drop-shadow(0 0 26px rgba(99,246,255,.3))",
    coreGlow:
      "drop-shadow(0 0 14px rgba(99,246,255,.55)) drop-shadow(0 0 28px rgba(99,246,255,.32))",
  },
  "assistant-active": {
    showBgCanvas: true,
    bgDensity: 0.85, // dense particle field when voice is live
    showSecondRing: true,
    showBeam: true,
    showFxCanvas: true,
    fxIntensity: 2.2, // strongly amplified active waveform (baseline, further scaled by audioLevel)
    showWordmark: false,
    showVignette: true,
    audioReactive: true,
    bgRadialGradient: false,
    beamOpacity: 1,
    emblemGlow:
      "drop-shadow(0 0 6px rgba(99,246,255,1)) drop-shadow(0 0 22px rgba(99,246,255,.78)) drop-shadow(0 0 44px rgba(99,246,255,.48)) drop-shadow(0 0 80px rgba(99,246,255,.22))",
    coreGlow:
      "drop-shadow(0 0 24px rgba(99,246,255,.85)) drop-shadow(0 0 52px rgba(99,246,255,.55)) drop-shadow(0 0 92px rgba(99,246,255,.3))",
  },
};

function resolveSurface(
  surface: AkiorSurface | undefined,
  mode: AkiorMode | undefined,
): AkiorSurface {
  if (surface) return surface;
  if (mode === "compact") return "assistant-standby";
  return "fullscreen";
}

export default function AkiorCore({
  state = "idle",
  className = "",
  size = 420,
  surface,
  mode,
  audioLevel = 0,
  reducedMotion = false,
}: AkiorCoreProps) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const resolvedSurface = resolveSurface(surface, mode);
  const recipe = RECIPES[resolvedSurface];
  const isFullscreenClass = /\bakiorv3--fullscreen\b/.test(className ?? "");

  // Live audio level passed to canvas draw loop without triggering re-seed.
  const audioLevelRef = useRef(audioLevel);
  audioLevelRef.current = audioLevel;

  useEffect(() => {
    if (!recipe.showBgCanvas && !recipe.showFxCanvas) return;
    const bg = bgRef.current;
    const fx = fxRef.current;
    const container = containerRef.current;
    if (!container) return;
    if (recipe.showBgCanvas && !bg) return;
    if (recipe.showFxCanvas && !fx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const ctxBg = bg ? bg.getContext("2d") : null;
    const ctxFx = fx ? fx.getContext("2d") : null;

    const t0 = performance.now();
    let width = 0;
    let height = 0;
    let rafId = 0;

    interface Particle {
      x: number;
      y: number;
      r: number;
      a: number;
      s: number;
      vx?: number;
      vy?: number;
    }
    let particles: Particle[] = [];
    let orbs: Particle[] = [];
    let frontDust: Particle[] = [];

    const rnd = (min: number, max: number) => Math.random() * (max - min) + min;

    function seed() {
      const density = recipe.bgDensity;
      const pCount = Math.max(20, Math.round(90 * density));
      const dCount = Math.max(8, Math.round(26 * density));
      const oCount = Math.max(4, Math.round(14 * density));
      particles = Array.from({ length: pCount }, () => ({
        x: rnd(0, width),
        y: rnd(0, height),
        r: rnd(0.8, 2.3),
        a: rnd(0.12, 0.65),
        s: rnd(0.02, 0.12),
      }));
      frontDust = Array.from({ length: dCount }, () => ({
        x: rnd(0, width),
        y: rnd(height * 0.08, height * 0.86),
        r: rnd(1.2, 3.4),
        a: rnd(0.12, 0.34),
        s: rnd(0.03, 0.09),
      }));
      orbs = Array.from({ length: oCount }, () => ({
        x: rnd(0, width),
        y: rnd(height * 0.14, height * 0.8),
        r: rnd(34, 82),
        a: rnd(0.05, 0.14),
        vx: rnd(-0.03, 0.03),
        vy: rnd(-0.02, 0.02),
        s: 0,
      }));
    }

    function resize() {
      // Use offsetWidth/offsetHeight (untransformed layout box) instead of
      // getBoundingClientRect (returns transform-applied rect). During the
      // JarvisAssistant modal's scale-up animation the bounding rect is
      // smaller than the real content box; offset dimensions are unaffected
      // by transforms so canvases get sized to the true final scene bounds.
      width =
        container!.offsetWidth || container!.getBoundingClientRect().width;
      height =
        container!.offsetHeight || container!.getBoundingClientRect().height;
      if (bg) {
        bg.width = Math.floor(width * DPR);
        bg.height = Math.floor(height * DPR);
        bg.style.width = width + "px";
        bg.style.height = height + "px";
        ctxBg?.setTransform(DPR, 0, 0, DPR, 0, 0);
      }
      if (fx) {
        fx.width = Math.floor(width * DPR);
        fx.height = Math.floor(height * DPR);
        fx.style.width = width + "px";
        fx.style.height = height + "px";
        ctxFx?.setTransform(DPR, 0, 0, DPR, 0, 0);
      }
      seed();
    }

    function glowCircle(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      r: number,
      alpha: number,
    ) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(140,251,255,${alpha})`);
      g.addColorStop(0.35, `rgba(99,246,255,${(alpha * 0.34).toFixed(3)})`);
      g.addColorStop(1, "rgba(99,246,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function loop(now: number) {
      const t = (now - t0) * 0.001;
      const liveAudio = recipe.audioReactive ? audioLevelRef.current : 0;

      // bgCanvas: particles + orb gradients
      if (ctxBg) {
        ctxBg.clearRect(0, 0, width, height);
        for (const o of orbs) {
          o.x += o.vx ?? 0;
          o.y += o.vy ?? 0;
          if (o.x < -100) o.x = width + 100;
          if (o.x > width + 100) o.x = -100;
          if (o.y < -100) o.y = height + 100;
          if (o.y > height + 100) o.y = -100;
          glowCircle(
            ctxBg,
            o.x,
            o.y,
            o.r,
            o.a * (0.8 + Math.sin(t + o.r) * 0.08),
          );
        }
        for (const p of particles) {
          const a = p.a * (0.75 + 0.25 * Math.sin(t * 0.6 + p.x * 0.01));
          ctxBg.fillStyle = `rgba(126,240,255,${a.toFixed(3)})`;
          ctxBg.beginPath();
          ctxBg.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctxBg.fill();
        }
      }

      // fxCanvas: waveform line + vertical bars + front dust
      if (ctxFx) {
        ctxFx.clearRect(0, 0, width, height);
        // Canonical centerline: matches emblem/core art pivot at cy=430 of
        // the 1200-tall viewBox (430/1200 ≈ 0.358). This aligns the
        // canvas waveform with the SVG beam and the emblem center.
        const cy = height * 0.358;
        const cx = width * 0.5;

        const intensity = recipe.fxIntensity * (1 + liveAudio * 1.6);
        // Horizontal waveform line
        ctxFx.save();
        ctxFx.strokeStyle = `rgba(140,251,255,${(0.78 * (0.6 + recipe.fxIntensity * 0.4)).toFixed(3)})`;
        ctxFx.lineWidth = 1;
        ctxFx.shadowBlur = 14 + liveAudio * 10;
        ctxFx.shadowColor = "rgba(99,246,255,.5)";
        ctxFx.beginPath();
        const amp1 = 7 * intensity;
        const amp2 = 5 * intensity;
        for (let x = 0; x < width; x += 3) {
          const d = Math.abs((x - cx) / (width * 0.5));
          const env = Math.max(0, 1 - d * 1.6);
          const y =
            cy +
            Math.sin(x * 0.04 + t * 3.2) * amp1 * env +
            Math.sin(x * 0.013 - t * 2.1) * amp2 * env;
          x === 0 ? ctxFx.moveTo(x, y) : ctxFx.lineTo(x, y);
        }
        ctxFx.stroke();
        ctxFx.restore();

        // Vertical bars flanking the waveform (scaled to container width)
        ctxFx.save();
        const barRange = width * 0.38;
        const barStep = Math.max(4, Math.round(width / 80));
        for (let i = -barRange; i <= barRange; i += barStep) {
          const d = Math.abs(i) / barRange;
          const h =
            (1 - d) *
            (16 + 12 * Math.pow(Math.sin(t * 3 + i * 0.1), 2)) *
            intensity;
          const a = (0.05 + (1 - d) * 0.2) * (0.5 + recipe.fxIntensity * 0.5);
          ctxFx.strokeStyle = `rgba(99,246,255,${a.toFixed(3)})`;
          ctxFx.lineWidth = 1;
          ctxFx.shadowBlur = 10 + liveAudio * 6;
          ctxFx.shadowColor = "rgba(99,246,255,.55)";
          ctxFx.beginPath();
          ctxFx.moveTo(cx + i, cy - h);
          ctxFx.lineTo(cx + i, cy + h);
          ctxFx.stroke();
        }
        ctxFx.restore();

        // Front dust
        for (const p of frontDust) {
          p.y -= p.s;
          if (p.y < -20) {
            p.y = height + 20;
            p.x = rnd(0, width);
          }
          ctxFx.fillStyle = `rgba(140,251,255,${p.a.toFixed(3)})`;
          ctxFx.beginPath();
          ctxFx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctxFx.fill();
        }
      }

      rafId = requestAnimationFrame(loop);
    }

    // Defer initial measurement past the React commit phase so any parent
    // transform animation (e.g. JarvisAssistant modal scale-up) has a chance
    // to settle before getBoundingClientRect is read. Also observe the
    // container directly via ResizeObserver so any later layout/transform
    // change triggers a re-measure — window resize alone is not enough.
    let rafInit = requestAnimationFrame(() => {
      rafInit = requestAnimationFrame(() => {
        resize();
        rafId = requestAnimationFrame(loop);
      });
    });
    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    return () => {
      cancelAnimationFrame(rafInit);
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
    // Re-seed when surface density changes
  }, [
    recipe.showBgCanvas,
    recipe.showFxCanvas,
    recipe.bgDensity,
    recipe.fxIntensity,
    recipe.audioReactive,
  ]);

  // Live glow reactivity on the outer scene (works even when audioReactive off)
  const liveCoreBoost = recipe.audioReactive ? 1 + audioLevel * 0.5 : 1;

  return (
    <div
      ref={containerRef}
      className={`akior-scene ${className}`}
      data-state={state}
      data-surface={resolvedSurface}
      style={{
        position: isFullscreenClass ? "fixed" : "relative",
        inset: isFullscreenClass ? 0 : undefined,
        width: isFullscreenClass
          ? "100vw"
          : typeof size === "number"
            ? `${size}px`
            : size,
        // Fullscreen uses viewport height. Embedded surfaces use the
        // canonical 1600×1200 landscape aspect of the AKIOR layer SVGs
        // (art pivot is at cx=800 cy=430, deliberately upper-center for a
        // landscape panel). Forcing a square container here was the root
        // cause of the framed / top-heavy look.
        height: isFullscreenClass ? "100vh" : undefined,
        aspectRatio: isFullscreenClass ? undefined : "1600 / 1200",
        overflow: "hidden",
        background: recipe.bgRadialGradient
          ? "radial-gradient(circle at 50% 42%, rgba(27,210,255,.16), rgba(0,0,0,0) 28%), radial-gradient(circle at 50% 45%, rgba(0,170,255,.08), rgba(0,0,0,0) 48%), linear-gradient(180deg,#02142b,#020c1f)"
          : "transparent",
        pointerEvents: "none",
      }}
    >
      {/* Background canvas — particles + orb gradients */}
      {recipe.showBgCanvas && (
        <canvas
          ref={bgRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        />
      )}

      {/* SVG layer stack */}
      <div style={{ position: "absolute", inset: 0 }}>
        {/* Rings copy A */}
        <img
          src="/akior/layers/akior_layer_rings.svg"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 0.48,
            mixBlendMode: "screen",
            animation: "akiorSpinSlow 40s linear infinite",
            transformOrigin: "50% 36%",
          }}
        />

        {/* Rings copy B — counter-rotating */}
        {recipe.showSecondRing && (
          <img
            src="/akior/layers/akior_layer_rings.svg"
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: 0.28,
              mixBlendMode: "screen",
              animation: "akiorSpinSlow 64s linear infinite reverse",
              transformOrigin: "50% 36%",
            }}
          />
        )}

        {/* Beam — horizontal energy line */}
        {recipe.showBeam && (
          <img
            src="/akior/layers/akior_layer_beam.svg"
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: recipe.beamOpacity,
              mixBlendMode: "screen",
              filter:
                "drop-shadow(0 0 10px rgba(99,246,255,.7)) drop-shadow(0 0 28px rgba(99,246,255,.28))",
            }}
          />
        )}

        {/* FX canvas — waveform + bars + dust */}
        {recipe.showFxCanvas && (
          <canvas
            ref={fxRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          />
        )}

        {/* Emblem — sacred geometry */}
        <img
          src="/akior/layers/akior_layer_emblem.svg"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 0.95,
            mixBlendMode: "screen",
            filter: recipe.emblemGlow,
            animation: "akiorBreathe 5.2s ease-in-out infinite",
            transformOrigin: "50% 36%",
          }}
        />

        {/* Core — bright center */}
        <img
          src="/akior/layers/akior_layer_core.svg"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 0.96,
            mixBlendMode: "screen",
            filter: recipe.coreGlow,
            animation: "akiorCorePulse 2.4s ease-in-out infinite",
            transform: `scale(${liveCoreBoost})`,
            transformOrigin: "50% 36%",
            transition: "transform 120ms ease-out",
          }}
        />

        {/* Wordmark — fullscreen only */}
        {recipe.showWordmark && (
          <img
            src="/akior/layers/akior_layer_wordmark.svg"
            alt="AKIOR"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: 0.92,
              mixBlendMode: "screen",
              filter: "drop-shadow(0 0 8px rgba(99,246,255,.28))",
              animation: "akiorTextPulse 6s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* Vignette */}
      {recipe.showVignette && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              resolvedSurface === "fullscreen"
                ? "radial-gradient(circle at center, transparent 40%, rgba(0,0,0,.22) 76%, rgba(0,0,0,.48) 100%)"
                : "radial-gradient(circle at center, transparent 50%, rgba(0,0,0,.18) 78%, rgba(0,0,0,.38) 100%)",
          }}
        />
      )}
    </div>
  );
}
