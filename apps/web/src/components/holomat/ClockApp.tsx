'use client';

import React, { useState, useEffect } from 'react';

interface ClockAppProps {
  onClose: () => void;
}

export function ClockApp({ onClose }: ClockAppProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const milliseconds = time.getMilliseconds();

  // Calculate angles for analog clock
  const secondAngle = (seconds + milliseconds / 1000) * 6; // 360/60
  const minuteAngle = (minutes + seconds / 60) * 6;
  const hourAngle = ((hours % 12) + minutes / 60) * 30; // 360/12

  const formatTime = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="relative w-[450px] bg-black/80 backdrop-blur-xl border-2 border-emerald-400/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(16,185,129,0.4)]">
      {/* Header */}
      <div 
        className="flex items-center justify-between mb-6 cursor-grab active:cursor-grabbing" 
        data-drag-handle
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">⏰</div>
          <h2 className="text-xl font-bold text-emerald-400 tracking-wider">CHRONOMETER</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 border border-red-400/30"
        >
          ✕
        </button>
      </div>

      {/* Digital Display */}
      <div className="mb-6 p-6 bg-emerald-950/30 border-2 border-emerald-400/30 rounded-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent" />
        <div className="relative">
          <div className="text-6xl font-bold text-emerald-100 tracking-wider font-mono text-center mb-2">
            {formatTime(hours)}:{formatTime(minutes)}:{formatTime(seconds)}
          </div>
          <div className="text-center text-sm text-emerald-400/60 tracking-widest">
            {time.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>
        {/* Scan line effect */}
        <div
          className="absolute left-0 right-0 h-0.5 bg-emerald-400/50"
          style={{
            animation: 'scanline 3s linear infinite',
          }}
        />
      </div>

      {/* Analog Clock */}
      <div className="flex justify-center mb-6">
        <div className="relative w-64 h-64">
          {/* Clock face */}
          <div className="absolute inset-0 rounded-full border-4 border-emerald-400/30 bg-emerald-950/20 shadow-[inset_0_0_30px_rgba(16,185,129,0.2)]">
            {/* Hour markers */}
            {[...Array(12)].map((_, i) => {
              const angle = (i * 30 - 90) * (Math.PI / 180);
              const isMain = i % 3 === 0;
              const distance = 105;
              const x = 128 + Math.cos(angle) * distance;
              const y = 128 + Math.sin(angle) * distance;
              
              return (
                <div
                  key={i}
                  className={`absolute ${isMain ? 'w-2 h-2' : 'w-1.5 h-1.5'} rounded-full`}
                  style={{
                    left: x,
                    top: y,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: isMain ? '#10b981' : '#10b98160',
                    boxShadow: isMain ? '0 0 8px #10b981' : 'none',
                  }}
                />
              );
            })}

            {/* Center point */}
            <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-emerald-400 rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(16,185,129,0.8)] z-30" />

            {/* Hour hand */}
            <div
              className="absolute top-1/2 left-1/2 origin-bottom"
              style={{
                width: '6px',
                height: '60px',
                backgroundColor: '#10b981',
                transform: `translate(-50%, -100%) rotate(${hourAngle}deg)`,
                boxShadow: '0 0 10px rgba(16,185,129,0.6)',
                borderRadius: '3px',
              }}
            />

            {/* Minute hand */}
            <div
              className="absolute top-1/2 left-1/2 origin-bottom"
              style={{
                width: '4px',
                height: '85px',
                backgroundColor: '#34d399',
                transform: `translate(-50%, -100%) rotate(${minuteAngle}deg)`,
                boxShadow: '0 0 10px rgba(52,211,153,0.6)',
                borderRadius: '2px',
              }}
            />

            {/* Second hand */}
            <div
              className="absolute top-1/2 left-1/2 origin-bottom"
              style={{
                width: '2px',
                height: '95px',
                backgroundColor: '#6ee7b7',
                transform: `translate(-50%, -100%) rotate(${secondAngle}deg)`,
                boxShadow: '0 0 15px rgba(110,231,183,0.8)',
                borderRadius: '1px',
                transition: 'transform 0.1s cubic-bezier(0.4, 0.0, 0.2, 1)',
              }}
            />

            {/* Rotating ring effect */}
            <div
              className="absolute inset-2 rounded-full border-2 border-emerald-400/20"
              style={{
                animation: 'rotateRing 20s linear infinite',
              }}
            />
          </div>
        </div>
      </div>

      {/* Time zones / Additional info */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-emerald-950/30 border border-emerald-400/20 rounded-lg text-center">
          <div className="text-xs text-emerald-400/60 mb-1">UTC</div>
          <div className="text-sm font-bold text-emerald-100 font-mono">
            {formatTime(time.getUTCHours())}:{formatTime(time.getUTCMinutes())}
          </div>
        </div>
        <div className="p-3 bg-emerald-950/30 border border-emerald-400/20 rounded-lg text-center">
          <div className="text-xs text-emerald-400/60 mb-1">EPOCH</div>
          <div className="text-sm font-bold text-emerald-100 font-mono">
            {Math.floor(time.getTime() / 1000)}
          </div>
        </div>
        <div className="p-3 bg-emerald-950/30 border border-emerald-400/20 rounded-lg text-center">
          <div className="text-xs text-emerald-400/60 mb-1">DAY</div>
          <div className="text-sm font-bold text-emerald-100 font-mono">
            {time.getDate()}/{time.getMonth() + 1}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scanline {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 0.5; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes rotateRing {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

