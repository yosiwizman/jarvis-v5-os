'use client';

import React, { useState, useRef, useCallback } from 'react';

interface DraggableAppProps {
  children: React.ReactNode;
  initialPosition: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
}

export function DraggableApp({ children, initialPosition, onPositionChange }: DraggableAppProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragStartOffset = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only start drag if clicking on the header/title area
    const target = e.target as HTMLElement;
    const header = target.closest('[data-drag-handle]');
    
    if (!header) return;

    e.preventDefault();
    e.stopPropagation();

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartOffset.current = { x: position.x, y: position.y };
    setIsDragging(true);

    // Capture pointer to continue receiving events even if cursor leaves element
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStartPos.current || !dragStartOffset.current) return;

    e.preventDefault();
    e.stopPropagation();

    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;

    const newPosition = {
      x: dragStartOffset.current.x + dx,
      y: dragStartOffset.current.y + dy,
    };

    setPosition(newPosition);
    onPositionChange?.(newPosition);
  }, [isDragging, onPositionChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(false);
    dragStartPos.current = null;
    dragStartOffset.current = null;

    // Release pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, [isDragging]);

  return (
    <div
      className="absolute"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        cursor: isDragging ? 'grabbing' : 'default',
        zIndex: isDragging ? 100 : 50,
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {children}
    </div>
  );
}



