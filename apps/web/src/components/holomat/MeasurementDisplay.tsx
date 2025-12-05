'use client';

import React from 'react';

export interface Measurement {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  lengthPx: number;
  lengthMm: number;
}

interface MeasurementDisplayProps {
  measurements: Measurement[];
}

export function MeasurementDisplay({ measurements }: MeasurementDisplayProps) {
  return (
    <>
      {measurements.map((measurement) => {
        const dx = measurement.endX - measurement.startX;
        const dy = measurement.endY - measurement.startY;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const length = measurement.lengthPx;
        const midX = (measurement.startX + measurement.endX) / 2;
        const midY = (measurement.startY + measurement.endY) / 2;

        return (
          <div key={measurement.id} className="absolute pointer-events-none">
            {/* Start point */}
            <div
              className="absolute w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"
              style={{
                left: measurement.startX,
                top: measurement.startY,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-75" />
            </div>

            {/* End point */}
            <div
              className="absolute w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"
              style={{
                left: measurement.endX,
                top: measurement.endY,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-75" />
            </div>

            {/* Line */}
            <div
              className="absolute h-0.5 bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]"
              style={{
                left: measurement.startX,
                top: measurement.startY,
                width: length,
                transformOrigin: '0 0',
                transform: `rotate(${angle}deg)`,
              }}
            />

            {/* Tick marks at ends */}
            <div
              className="absolute w-0.5 h-4 bg-cyan-400"
              style={{
                left: measurement.startX,
                top: measurement.startY,
                transformOrigin: '50% 50%',
                transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
              }}
            />
            <div
              className="absolute w-0.5 h-4 bg-cyan-400"
              style={{
                left: measurement.endX,
                top: measurement.endY,
                transformOrigin: '50% 50%',
                transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
              }}
            />

            {/* Measurement label */}
            <div
              className="absolute"
              style={{
                left: midX,
                top: midY - 20,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="relative px-3 py-1.5 bg-black/90 backdrop-blur-sm border-2 border-cyan-400/60 rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-transparent rounded-lg" />
                
                <div className="relative text-cyan-100 font-mono font-bold text-sm tracking-wider whitespace-nowrap">
                  {measurement.lengthMm.toFixed(1)} <span className="text-cyan-400">mm</span>
                </div>

                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-cyan-400" />
                <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-cyan-400" />
                <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-cyan-400" />
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-cyan-400" />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}



