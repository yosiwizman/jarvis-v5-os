'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getCameraSocket } from '@/lib/socket';

export default function ScanPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen bg-black overflow-hidden"
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
            className="absolute left-0 right-0 h-2 bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_40px_rgba(34,211,238,1),0_0_80px_rgba(34,211,238,0.6)]"
            style={{
              animation: 'scan 3s ease-in-out',
              top: 0,
            }}
          />
          
          {/* Secondary glow effect */}
          <div 
            className="absolute left-0 right-0 h-12 bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent blur-2xl"
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

      {/* Scan Button */}
      <button
        onClick={triggerScan}
        disabled={isScanning}
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
      `}</style>
    </div>
  );
}

