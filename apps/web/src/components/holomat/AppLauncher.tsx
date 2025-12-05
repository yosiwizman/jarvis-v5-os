'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
  component: React.ComponentType<{ onClose: () => void }>;
}

interface AppLauncherProps {
  apps: AppDefinition[];
  onAppOpen: (app: AppDefinition, position: { x: number; y: number }) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

interface AppCard {
  app: AppDefinition;
  angle: number;
  index: number;
}

export function AppLauncher({ apps, onAppOpen, containerRef }: AppLauncherProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [ringPosition, setRingPosition] = useState<{ x: number; y: number } | null>(null);
  const [ringSize, setRingSize] = useState(0);
  const [showCards, setShowCards] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [dragDistance, setDragDistance] = useState(0);
  
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const ringAnimationFrame = useRef<number | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const hasMoved = useRef<boolean>(false);

  // Initialize ring at screen center when component mounts (menu mode is active)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Set ring position at center
    setRingPosition({ x: centerX, y: centerY });
    setRingSize(0);
    setShowCards(false);

    // Animate ring expansion
    let size = 0;
    const animate = () => {
      size += 12; // Faster animation
      setRingSize(size);
      if (size < 200) {
        ringAnimationFrame.current = requestAnimationFrame(animate);
      } else {
        setShowCards(true);
      }
    };
    ringAnimationFrame.current = requestAnimationFrame(animate);

    return () => {
      if (ringAnimationFrame.current) {
        cancelAnimationFrame(ringAnimationFrame.current);
      }
    };
  }, [containerRef]);

  const handlePointerDown = useCallback((e: React.PointerEvent | PointerEvent) => {
    // Don't trigger if clicking on a button or interactive element
    const target = e.target as HTMLElement;
    if (target.closest('button, [role="button"], [data-no-launcher]')) {
      return;
    }

    // If clicking on a card, prepare for click/drag
    const cardElement = target.closest('[data-app-card]');
    if (cardElement) {
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      startPos.current = { x, y };
      hasMoved.current = false;
      setIsPressed(true);
      return;
    }
  }, [containerRef]);

  const handlePointerMove = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (!isPressed || !startPos.current) return;

    // Get position relative to container
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const dx = currentX - startPos.current.x;
    const dy = currentY - startPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Track if pointer has moved significantly (more than 5px = drag, not click)
    if (distance > 5) {
      hasMoved.current = true;
    }

    if (!showCards) return;

    // Check if hovering over a card
    const cardElements = document.querySelectorAll('[data-app-card]');
    let foundCard: string | null = null;
    
    cardElements.forEach((el) => {
      const cardRect = el.getBoundingClientRect();
      const centerX = cardRect.left + cardRect.width / 2;
      const centerY = cardRect.top + cardRect.height / 2;
      const cardDist = Math.sqrt(
        Math.pow((e.clientX) - centerX, 2) + Math.pow((e.clientY) - centerY, 2)
      );
      
      if (cardDist < 60) {
        foundCard = el.getAttribute('data-app-card');
      }
    });

    if (foundCard) {
      setHoveredCard(foundCard);
      setDraggedCard(foundCard);
      
      // Calculate drag distance for this card
      const cardEl = document.querySelector(`[data-app-card="${foundCard}"]`);
      if (cardEl) {
        const cardRect = cardEl.getBoundingClientRect();
        const centerX = cardRect.left + cardRect.width / 2;
        const centerY = cardRect.top + cardRect.height / 2;
        const cardDx = (e.clientX) - centerX;
        const cardDy = (e.clientY) - centerY;
        const cardDistance = Math.sqrt(cardDx * cardDx + cardDy * cardDy);
        setDragDistance(cardDistance);
      }
    } else {
      setHoveredCard(null);
      setDraggedCard(null);
      setDragDistance(0);
    }
  }, [isPressed, startPos, showCards, containerRef]);

  const handlePointerUp = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (!isPressed) return;

    const target = e.target as HTMLElement;
    const cardElement = target.closest('[data-app-card]');
    
    // Check if it was a click (not a drag) on a card
    if (cardElement && !hasMoved.current && ringPosition) {
      const appId = cardElement.getAttribute('data-app-card');
      const app = apps.find(a => a.id === appId);
      if (app) {
        console.log('🎯 Card clicked, opening app:', app.name);
        onAppOpen(app, ringPosition);
      }
    }

    // Check if a card was dragged out far enough (threshold: 80px)
    if (draggedCard && dragDistance > 80 && ringPosition) {
      const app = apps.find(a => a.id === draggedCard);
      if (app) {
        console.log('🎯 Card dragged out, opening app:', app.name);
        onAppOpen(app, ringPosition);
      }
    }

    // Reset interaction state
    setIsPressed(false);
    setHoveredCard(null);
    setDraggedCard(null);
    setDragDistance(0);
  }, [isPressed, draggedCard, dragDistance, ringPosition, apps, onAppOpen]);

  // Calculate card positions in a circle - TOP HALF ONLY, fanned out
  const getCardPositions = (): AppCard[] => {
    const radius = 160; // Increased distance from circle
    // Spread cards across top half of circle (from left to right through the top)
    // In browser coordinates, Y+ is down, so top half has negative Y (angles from π to 2π)
    const startAngle = Math.PI; // Left side (9 o'clock)
    const endAngle = 2 * Math.PI; // Right side (3 o'clock), going through top
    const totalAngle = endAngle - startAngle; // π radians (180 degrees)
    
    return apps.map((app, index) => {
      // Distribute evenly across the top half
      const t = apps.length > 1 ? index / (apps.length - 1) : 0.5;
      const angle = startAngle + (t * totalAngle);
      
      return {
        app,
        angle,
        index
      };
    });
  };

  // Attach event listeners to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      console.log('⚠️ Container ref not available');
      return;
    }

    console.log('✅ AppLauncher: Attaching event listeners to container');

    container.addEventListener('pointerdown', handlePointerDown as any);
    container.addEventListener('pointermove', handlePointerMove as any);
    container.addEventListener('pointerup', handlePointerUp as any);
    container.addEventListener('pointercancel', handlePointerUp as any);

    return () => {
      console.log('🧹 AppLauncher: Cleaning up event listeners');
      container.removeEventListener('pointerdown', handlePointerDown as any);
      container.removeEventListener('pointermove', handlePointerMove as any);
      container.removeEventListener('pointerup', handlePointerUp as any);
      container.removeEventListener('pointercancel', handlePointerUp as any);
    };
  }, [containerRef, handlePointerDown, handlePointerMove, handlePointerUp]);

  const cards = ringPosition ? getCardPositions() : [];

  return (
    <>
      {/* Ring animation */}
      {ringPosition && (
        <div
          className="absolute rounded-full border-4 border-cyan-400/60 shadow-[0_0_30px_rgba(34,211,238,0.6)] pointer-events-none z-40"
          style={{
            left: ringPosition.x,
            top: ringPosition.y,
            width: ringSize,
            height: ringSize,
            transform: 'translate(-50%, -50%)',
            transition: 'opacity 0.2s',
            opacity: showCards ? 0.4 : 1,
          }}
        />
      )}

      {/* App cards */}
      {showCards && ringPosition && cards.map(({ app, angle, index }) => {
        const radius = 160; // Match the increased radius
        const x = ringPosition.x + Math.cos(angle) * radius;
        const y = ringPosition.y + Math.sin(angle) * radius;
        const isHovered = hoveredCard === app.id;
        const isDragged = draggedCard === app.id;
        const popDistance = isDragged ? Math.min(dragDistance, 100) : (isHovered ? 20 : 0);

        // Calculate rotation so card's top points away from circle center
        // Convert radians to degrees and rotate so top of folder faces outward
        const angleDegrees = angle * (180 / Math.PI);
        const cardRotation = angleDegrees + 90;
        
        console.log(`Card ${app.name}: angle=${angleDegrees.toFixed(1)}°, rotation=${cardRotation.toFixed(1)}°`);

        return (
          <div
            key={app.id}
            data-app-card={app.id}
            className="absolute cursor-pointer pointer-events-auto z-40"
            style={{
              left: x + Math.cos(angle) * popDistance,
              top: y + Math.sin(angle) * popDistance,
              transform: `translate(-50%, -50%) rotate(${cardRotation}deg) scale(${isHovered || isDragged ? 1.1 : 1})`,
              animationDelay: `${index * 50}ms`,
              animation: 'cardPopIn 0.3s ease-out forwards',
              opacity: isDragged && dragDistance > 80 ? 0.7 : 1,
              transition: 'transform 0.2s, opacity 0.2s',
              ['--card-rotation' as any]: `${cardRotation}deg`,
            }}
          >
            {/* Folder card */}
            <div
              className="relative w-24 h-32 rounded-lg shadow-lg backdrop-blur-sm"
              style={{
                background: `linear-gradient(135deg, ${app.color}dd, ${app.color}bb)`,
                border: `2px solid ${app.color}`,
                boxShadow: isHovered || isDragged
                  ? `0 0 30px ${app.color}80`
                  : `0 0 15px ${app.color}40`,
              }}
            >
              {/* Folder tab with name */}
              <div
                className="absolute -top-2 left-2 h-5 px-2 rounded-t-md flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${app.color}ee, ${app.color}cc)`,
                  border: `2px solid ${app.color}`,
                  borderBottom: 'none',
                  minWidth: '3rem',
                }}
              >
                <div
                  className="text-[0.65rem] font-bold text-white tracking-wider whitespace-nowrap"
                  style={{
                    textShadow: `0 0 8px ${app.color}`,
                  }}
                >
                  {app.name}
                </div>
              </div>

              {/* Icon */}
              <div className="flex items-center justify-center h-full p-2">
                <div
                  className="text-5xl"
                  style={{
                    filter: `drop-shadow(0 0 10px ${app.color})`,
                  }}
                >
                  {app.icon}
                </div>
              </div>

              {/* Corner accents */}
              <div
                className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 rounded-tl"
                style={{ borderColor: app.color }}
              />
              <div
                className="absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 rounded-tr"
                style={{ borderColor: app.color }}
              />
              <div
                className="absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 rounded-bl"
                style={{ borderColor: app.color }}
              />
              <div
                className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 rounded-br"
                style={{ borderColor: app.color }}
              />
            </div>
          </div>
        );
      })}

      <style jsx>{`
        @keyframes cardPopIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--card-rotation, 0deg)) scale(0.3);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--card-rotation, 0deg)) scale(1);
          }
        }
      `}</style>
    </>
  );
}

