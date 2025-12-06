'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getCameraSocket } from '@/lib/socket';
import { AppLauncher, AppDefinition } from '@/components/holomat/AppLauncher';
import { MeasurementDisplay, Measurement } from '@/components/holomat/MeasurementDisplay';
import { DraggableApp } from '@/components/holomat/DraggableApp';
import { ClockApp } from '@/components/holomat/ClockApp';
import { CalendarApp } from '@/components/holomat/CalendarApp';
import { CalculatorApp } from '@/components/holomat/CalculatorApp';
import { ModelViewerApp } from '@/components/holomat/ModelViewerApp';
import { ModelCreatorApp as ModelCreator } from '@/components/holomat/ModelCreatorApp';
import { FilesApp, SecurityApp } from '@/components/holomat/DummyApps';
import { SettingsApp } from '@/components/holomat/SettingsApp';

type Mode = 'normal' | 'measurement' | 'menu' | 'settings';

interface OpenApp {
  id: string;
  app: AppDefinition;
  position: { x: number; y: number };
}

export default function ScanPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mode, setMode] = useState<Mode>('normal');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [currentMeasurement, setCurrentMeasurement] = useState<{ startX: number; startY: number } | null>(null);
  const [tempEndPos, setTempEndPos] = useState<{ x: number; y: number } | null>(null);
  const [pixelToMmRatio, setPixelToMmRatio] = useState(2.5); // Default: 2.5 pixels = 1mm
  const [openApps, setOpenApps] = useState<OpenApp[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // App definitions
  const apps: AppDefinition[] = [
    {
      id: 'clock',
      name: 'CLOCK',
      icon: '⏰',
      color: '#10b981',
      component: ClockApp,
    },
    {
      id: 'calendar',
      name: 'CALENDAR',
      icon: '📅',
      color: '#3b82f6',
      component: CalendarApp,
    },
    {
      id: 'calculator',
      name: 'CALC',
      icon: '🧮',
      color: '#f59e0b',
      component: CalculatorApp,
    },
    {
      id: 'viewer',
      name: '3D VIEW',
      icon: '🔮',
      color: '#a855f7',
      component: ModelViewerApp,
    },
    {
      id: 'creator',
      name: 'CREATOR',
      icon: '🏗️',
      color: '#ec4899',
      component: ModelCreator,
    },
    {
      id: 'files',
      name: 'FILES',
      icon: '📁',
      color: '#14b8a6',
      component: FilesApp,
    },
    {
      id: 'security',
      name: 'SECURITY',
      icon: '🛡️',
      color: '#ef4444',
      component: SecurityApp,
    },
  ];

  // Listen for scan triggers from server
  useEffect(() => {
    const socket = getCameraSocket();
    
    const handleScanTrigger = () => {
      console.log('🔍 Scan triggered by server');
      triggerScan();
    };

    socket?.on('scan:trigger', handleScanTrigger);

    return () => {
      socket?.off('scan:trigger', handleScanTrigger);
    };
  }, []);

  const triggerScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    
    // Animation lasts 3 seconds
    setTimeout(() => {
      setIsScanning(false);
    }, 3000);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle measurement mode mouse events
  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'measurement') return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentMeasurement({ startX: x, startY: y });
    setTempEndPos({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (mode !== 'measurement' || !currentMeasurement) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setTempEndPos({ x, y });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (mode !== 'measurement' || !currentMeasurement) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    const dx = endX - currentMeasurement.startX;
    const dy = endY - currentMeasurement.startY;
    const lengthPx = Math.sqrt(dx * dx + dy * dy);
    const lengthMm = lengthPx / pixelToMmRatio;
    
    // Only add measurement if it's not too small
    if (lengthPx > 10) {
      const newMeasurement: Measurement = {
        id: Date.now().toString(),
        startX: currentMeasurement.startX,
        startY: currentMeasurement.startY,
        endX,
        endY,
        lengthPx,
        lengthMm,
      };
      
      setMeasurements([...measurements, newMeasurement]);
    }
    
    setCurrentMeasurement(null);
    setTempEndPos(null);
  };

  const clearMeasurements = () => {
    setMeasurements([]);
    setCurrentMeasurement(null);
    setTempEndPos(null);
  };

  const handleAppOpen = (app: AppDefinition, position: { x: number; y: number }) => {
    console.log('📱 Opening app:', app.name, 'at position:', position);
    const newApp: OpenApp = {
      id: Date.now().toString(),
      app,
      position,
    };
    setOpenApps([...openApps, newApp]);
  };

  const handleAppClose = (appId: string) => {
    setOpenApps(openApps.filter(a => a.id !== appId));
  };

  const handleModeChange = (newMode: Mode) => {
    // If already in the mode, toggle it off
    if (mode === newMode) {
      setMode('normal');
    } else {
      setMode(newMode);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        cursor: mode === 'measurement' ? 'crosshair' : 'default',
      }}
    >
      {/* Grid Background */}
      <div className="absolute inset-0">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path 
                d="M 100 0 L 0 0 0 100" 
                fill="none" 
                stroke="rgba(255, 255, 255, 0.25)" 
                strokeWidth="2.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Scanning Laser Animation */}
      {isScanning && (
        <>
          {/* Main laser beam */}
          <div 
            className="absolute left-0 right-0 h-2 bg-gradient-to-r from-transparent via-[color:rgb(var(--jarvis-accent))] to-transparent"
            style={{
              animation: 'scan 3s ease-in-out',
              top: 0,
              boxShadow: '0 0 40px rgb(var(--jarvis-accent)), 0 0 80px rgb(var(--jarvis-accent) / 0.6)'
            }}
          />
          
          {/* Secondary glow effect */}
          <div 
            className="absolute left-0 right-0 h-12 bg-gradient-to-r from-transparent via-[color:rgb(var(--jarvis-accent)_/_0.5)] to-transparent blur-2xl"
            style={{
              animation: 'scan 3s ease-in-out',
              top: 0,
            }}
          />
        </>
      )}

      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        data-no-launcher
        className="absolute top-6 right-6 z-50 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 rounded-lg transition-all duration-300 group"
      >
        <div className="flex items-center gap-2 text-white">
          {isFullscreen ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
              <span className="text-sm font-medium">Exit Fullscreen</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span className="text-sm font-medium">Fullscreen</span>
            </>
          )}
        </div>
      </button>

      {/* Mode Buttons - Right Side */}
      <div className="absolute top-24 right-6 z-50 flex flex-col gap-3" data-no-launcher>
        {/* Settings Button */}
        <button
          onClick={() => handleModeChange('settings')}
          className={`group relative p-3 backdrop-blur-md border-2 rounded-xl transition-all duration-300 ${
            mode === 'settings'
              ? 'bg-amber-500/30 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.6)]'
              : 'bg-white/10 hover:bg-amber-500/20 border-white/30 hover:border-amber-400/50'
          }`}
          title="Settings"
        >
          <svg className={`w-6 h-6 ${mode === 'settings' ? 'text-amber-400 animate-spin-slow' : 'text-white group-hover:text-amber-400'} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {mode === 'settings' && (
            <div className="absolute top-0 left-0 w-2 h-2 bg-amber-400 rounded-full animate-ping" />
          )}
        </button>

        {/* Measurement Button */}
        <button
          onClick={() => handleModeChange('measurement')}
          className={`group relative p-3 backdrop-blur-md border-2 rounded-xl transition-all duration-300 ${
            mode === 'measurement'
              ? 'bg-cyan-500/30 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.6)]'
              : 'bg-white/10 hover:bg-cyan-500/20 border-white/30 hover:border-cyan-400/50'
          }`}
          title="Measurement Tool"
        >
          <svg className={`w-6 h-6 ${mode === 'measurement' ? 'text-cyan-400' : 'text-white group-hover:text-cyan-400'} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          {mode === 'measurement' && (
            <div className="absolute top-0 left-0 w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
          )}
        </button>

        {/* Menu Button */}
        <button
          onClick={() => handleModeChange('menu')}
          className={`group relative p-3 backdrop-blur-md border-2 rounded-xl transition-all duration-300 ${
            mode === 'menu'
              ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.3)] border-[color:rgb(var(--jarvis-accent))] jarvis-accent-shadow'
              : 'bg-white/10 hover:bg-[color:rgb(var(--jarvis-accent)_/_0.2)] border-white/30 hover:border-[color:rgb(var(--jarvis-accent)_/_0.5)]'
          }`}
          title="App Menu"
        >
          <svg className={`w-6 h-6 ${mode === 'menu' ? 'jarvis-accent-text' : 'text-white group-hover:jarvis-accent-text'} transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          {mode === 'menu' && (
            <div className="absolute top-0 left-0 w-2 h-2 rounded-full animate-ping jarvis-accent-bg" />
          )}
        </button>
      </div>

      {/* Clear Measurements Button - Bottom Left (only in measurement mode) */}
      {mode === 'measurement' && measurements.length > 0 && (
        <button
          onClick={clearMeasurements}
          data-no-launcher
          className="absolute bottom-12 left-6 z-50 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 backdrop-blur-md border-2 border-red-400/50 hover:border-red-400 rounded-xl transition-all duration-300 group shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-sm font-bold text-red-400 tracking-wider">CLEAR ALL</span>
          </div>
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-red-400 rounded-tl" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-red-400 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-red-400 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-red-400 rounded-br" />
        </button>
      )}

      {/* Measurements Display */}
      <MeasurementDisplay measurements={measurements} />

      {/* Current measurement being drawn */}
      {currentMeasurement && tempEndPos && (
        <div className="absolute pointer-events-none">
          {/* Start point */}
          <div
            className="absolute w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"
            style={{
              left: currentMeasurement.startX,
              top: currentMeasurement.startY,
              transform: 'translate(-50%, -50%)',
            }}
          />

          {/* End point */}
          <div
            className="absolute w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"
            style={{
              left: tempEndPos.x,
              top: tempEndPos.y,
              transform: 'translate(-50%, -50%)',
            }}
          />

          {/* Line */}
          <div
            className="absolute h-0.5 bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]"
            style={{
              left: currentMeasurement.startX,
              top: currentMeasurement.startY,
              width: Math.sqrt(
                Math.pow(tempEndPos.x - currentMeasurement.startX, 2) +
                Math.pow(tempEndPos.y - currentMeasurement.startY, 2)
              ),
              transformOrigin: '0 0',
              transform: `rotate(${Math.atan2(
                tempEndPos.y - currentMeasurement.startY,
                tempEndPos.x - currentMeasurement.startX
              ) * (180 / Math.PI)}deg)`,
            }}
          />

          {/* Measurement label */}
          <div
            className="absolute"
            style={{
              left: (currentMeasurement.startX + tempEndPos.x) / 2,
              top: (currentMeasurement.startY + tempEndPos.y) / 2 - 20,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="relative px-3 py-1.5 bg-black/90 backdrop-blur-sm border-2 border-cyan-400/60 rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.4)]">
              <div className="relative text-cyan-100 font-mono font-bold text-sm tracking-wider whitespace-nowrap">
                {(Math.sqrt(
                  Math.pow(tempEndPos.x - currentMeasurement.startX, 2) +
                  Math.pow(tempEndPos.y - currentMeasurement.startY, 2)
                ) / pixelToMmRatio).toFixed(1)} <span className="text-cyan-400">mm</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* App Launcher (Menu Mode) */}
      {mode === 'menu' && (
        <AppLauncher
          apps={apps}
          onAppOpen={handleAppOpen}
          containerRef={containerRef}
        />
      )}

      {/* Settings Popup */}
      {mode === 'settings' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <SettingsApp
              onClose={() => setMode('normal')}
              pixelToMmRatio={pixelToMmRatio}
              onPixelToMmRatioChange={setPixelToMmRatio}
            />
          </div>
        </div>
      )}

      {/* Open Apps */}
      {openApps.map((openApp) => (
        <DraggableApp
          key={openApp.id}
          initialPosition={openApp.position}
          onPositionChange={() => {}}
        >
          <openApp.app.component onClose={() => handleAppClose(openApp.id)} />
        </DraggableApp>
      ))}

      {/* Scan Button */}
      <button
        onClick={triggerScan}
        disabled={isScanning}
        data-no-launcher
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 group"
      >
        <div className="relative">
          {/* Outer glow ring */}
          <div className="absolute inset-0 bg-cyan-500/30 rounded-full blur-2xl scale-150 group-hover:scale-175 transition-transform duration-300" />
          
          {/* Button container */}
          <div className="relative px-12 py-6 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 backdrop-blur-md border-2 border-cyan-400/50 rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.3)] group-hover:shadow-[0_0_50px_rgba(34,211,238,0.5)] transition-all duration-300">
            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-transparent rounded-2xl" />
            
            {/* Button text */}
            <div className="relative flex items-center gap-4">
              {isScanning ? (
                <>
                  <svg className="w-6 h-6 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-2xl font-bold text-white tracking-wider">SCANNING...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6 text-cyan-400 group-hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-2xl font-bold text-white tracking-wider group-hover:text-cyan-100 transition-colors">SCAN</span>
                </>
              )}
            </div>

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />
          </div>
        </div>
      </button>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes scan {
          0% {
            top: 0%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}

