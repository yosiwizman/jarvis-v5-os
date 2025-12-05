'use client';

import React from 'react';

interface DummyAppProps {
  onClose: () => void;
  title: string;
  icon: string;
  color: string;
  description: string;
}

function DummyApp({ onClose, title, icon, color, description }: DummyAppProps) {
  return (
    <div 
      className="relative w-96 bg-black/80 backdrop-blur-xl border-2 rounded-2xl p-6"
      style={{
        borderColor: `${color}80`,
        boxShadow: `0 0 40px ${color}40`,
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between mb-6 cursor-grab active:cursor-grabbing" 
        data-drag-handle
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">{icon}</div>
          <h2 
            className="text-xl font-bold tracking-wider"
            style={{ color }}
          >
            {title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 border border-red-400/30"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div 
        className="mb-6 p-8 border-2 rounded-xl relative overflow-hidden min-h-[300px] flex flex-col items-center justify-center"
        style={{
          backgroundColor: `${color}10`,
          borderColor: `${color}30`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-white/5" />
        
        {/* Large icon */}
        <div className="text-8xl mb-6 opacity-50">{icon}</div>
        
        {/* Coming soon message */}
        <div 
          className="text-2xl font-bold tracking-wider mb-4 text-center"
          style={{ 
            color,
            textShadow: `0 0 20px ${color}80`,
          }}
        >
          COMING SOON
        </div>
        
        <div className="text-sm text-white/60 text-center max-w-xs">
          {description}
        </div>

        {/* Animated scan lines */}
        <div
          className="absolute left-0 right-0 h-px opacity-50"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            animation: 'scanline 3s linear infinite',
          }}
        />

        {/* Corner accents */}
        <div 
          className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2"
          style={{ borderColor: color }}
        />
        <div 
          className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2"
          style={{ borderColor: color }}
        />
        <div 
          className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2"
          style={{ borderColor: color }}
        />
        <div 
          className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2"
          style={{ borderColor: color }}
        />
      </div>

      {/* Footer */}
      <div 
        className="text-center text-xs tracking-wider opacity-60"
        style={{ color }}
      >
        HOLOMAT SYSTEM • MODULE IN DEVELOPMENT
      </div>

      <style jsx>{`
        @keyframes scanline {
          0% { top: 0%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// Specific dummy apps
export function PrintersApp({ onClose }: { onClose: () => void }) {
  return (
    <DummyApp
      onClose={onClose}
      title="3D PRINTERS"
      icon="🖨️"
      color="#8b5cf6"
      description="Monitor and control connected 3D printers. Track print progress, manage queue, and adjust settings."
    />
  );
}

export function SecurityApp({ onClose }: { onClose: () => void }) {
  return (
    <DummyApp
      onClose={onClose}
      title="SECURITY"
      icon="🛡️"
      color="#ef4444"
      description="Access live security feeds from connected cameras. Monitor activity and review captured footage."
    />
  );
}

export function ImageStudioApp({ onClose }: { onClose: () => void }) {
  return (
    <DummyApp
      onClose={onClose}
      title="IMAGE STUDIO"
      icon="🖼️"
      color="#06b6d4"
      description="Generate AI-powered images using advanced models. Create, edit, and enhance visual content."
    />
  );
}

export function ModelCreatorApp({ onClose }: { onClose: () => void }) {
  return (
    <DummyApp
      onClose={onClose}
      title="MODEL CREATOR"
      icon="🏗️"
      color="#ec4899"
      description="Generate 3D models from text descriptions or images using AI. Transform ideas into printable objects."
    />
  );
}

export function FilesApp({ onClose }: { onClose: () => void }) {
  return (
    <DummyApp
      onClose={onClose}
      title="FILES"
      icon="📁"
      color="#14b8a6"
      description="Browse and manage your library of files, images, and 3D models. Organize and share your creations."
    />
  );
}

