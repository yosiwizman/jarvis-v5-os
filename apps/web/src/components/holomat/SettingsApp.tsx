'use client';

import React from 'react';

interface SettingsAppProps {
  onClose: () => void;
  pixelToMmRatio: number;
  onPixelToMmRatioChange: (ratio: number) => void;
}

export function SettingsApp({ onClose, pixelToMmRatio, onPixelToMmRatioChange }: SettingsAppProps) {
  return (
    <div className="relative w-[450px] bg-black/80 backdrop-blur-xl border-2 border-amber-400/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(251,191,36,0.4)]">
      {/* Header */}
      <div 
        className="flex items-center justify-between mb-6 cursor-grab active:cursor-grabbing" 
        data-drag-handle
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">⚙️</div>
          <h2 className="text-xl font-bold text-amber-400 tracking-wider">HOLOMAT SETTINGS</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 border border-red-400/30"
        >
          ✕
        </button>
      </div>

      {/* Settings Content */}
      <div className="space-y-6">
        {/* Pixel to MM Ratio */}
        <div className="p-4 bg-amber-950/30 border-2 border-amber-400/30 rounded-xl relative">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 to-transparent rounded-xl" />
          
          <div className="relative">
            <label className="block text-amber-400 font-bold text-sm tracking-wider mb-3">
              PIXEL TO MM RATIO
            </label>
            
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.1"
                value={pixelToMmRatio}
                onChange={(e) => onPixelToMmRatioChange(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-amber-950/50 rounded-lg appearance-none cursor-pointer accent-amber-400"
                style={{
                  background: `linear-gradient(to right, rgb(251 191 36 / 0.6) 0%, rgb(251 191 36 / 0.6) ${((pixelToMmRatio - 0.5) / 9.5) * 100}%, rgb(251 191 36 / 0.2) ${((pixelToMmRatio - 0.5) / 9.5) * 100}%, rgb(251 191 36 / 0.2) 100%)`,
                }}
              />
              
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={pixelToMmRatio}
                  onChange={(e) => onPixelToMmRatioChange(parseFloat(e.target.value) || 2.5)}
                  className="w-20 px-3 py-2 bg-amber-950/50 border border-amber-400/30 rounded-lg text-amber-100 font-mono text-center focus:outline-none focus:border-amber-400"
                />
                <span className="text-amber-400 font-bold text-sm">px/mm</span>
              </div>
            </div>

            <div className="mt-3 text-xs text-amber-400/60 tracking-wide">
              Calibrates measurement tool accuracy. Higher values = smaller measurements.
            </div>
          </div>

          {/* Corner accents */}
          <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-amber-400/50" />
          <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-amber-400/50" />
          <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-amber-400/50" />
          <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-amber-400/50" />
        </div>

        {/* Info Section */}
        <div className="p-4 border border-amber-400/20 rounded-lg">
          <div className="text-sm text-amber-400/80 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>Use the <span className="text-amber-400 font-bold">Mouse Tool</span> for normal interactions</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>Use the <span className="text-amber-400 font-bold">Measuring Tool</span> to measure distances</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              <span>Adjust ratio to match your display's physical dimensions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-amber-400/60 tracking-wider">
        HOLOMAT CONFIGURATION INTERFACE
      </div>
    </div>
  );
}



