'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { buildServerUrl } from '@/lib/api';
import { BRAND } from '@/lib/brand';

// Dynamically import 3D viewer to avoid SSR issues
const JarvisModelViewer = dynamic(
  () => import('@/components/JarvisModelViewer').then(mod => ({ default: mod.JarvisModelViewer })),
  { ssr: false }
);

interface ModelViewerAppProps {
  onClose: () => void;
  modelUrl?: string;
  modelName?: string;
}

export function ModelViewerApp({ onClose, modelUrl, modelName }: ModelViewerAppProps) {
  const [showPCBWayModal, setShowPCBWayModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);

  const materials = [
    { id: 'pla', name: 'PLA', color: 'bg-blue-500' },
    { id: 'abs', name: 'ABS', color: 'bg-purple-500' },
    { id: 'aluminum-5052', name: 'Aluminum 5052', color: 'bg-gray-400' },
    { id: 'aluminum-6061', name: 'Aluminum 6061', color: 'bg-gray-500' },
    { id: 'carbon-fiber', name: 'Carbon Fiber', color: 'bg-black' },
    { id: 'copper', name: 'Copper', color: 'bg-orange-600' },
    { id: 'stainless-steel', name: 'Stainless Steel', color: 'bg-gray-600' },
    { id: 'acrylic', name: 'Acrylic', color: 'bg-cyan-300' },
  ];

  const handlePlaceOrder = () => {
    if (selectedMaterial) {
      alert(`Order placed for ${modelName || 'model'} in ${materials.find(m => m.id === selectedMaterial)?.name}!`);
      setShowPCBWayModal(false);
      setSelectedMaterial(null);
    }
  };

  return (
    <div className="w-[900px] h-[700px] bg-black/90 backdrop-blur-md rounded-2xl border border-cyan-500/30 flex flex-col overflow-hidden relative">
      {/* Header with Close Button */}
      <div
        data-drag-handle
        className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-cyan-500/30 cursor-move"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">3D Model Viewer</h2>
            <p className="text-xs text-gray-400">{modelName || 'View and interact with 3D models'}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 flex items-center justify-center transition-all group"
        >
          <X className="w-5 h-5 text-red-400 group-hover:text-red-300" />
        </button>
      </div>

      {/* 3D Viewer Content */}
      <div className="flex-1 relative">
        {modelUrl ? (
          <JarvisModelViewer
            modelUrl={modelUrl}
            onError={(error) => {
              console.error('Model viewer error:', error);
              alert('Failed to load model');
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-gray-400 text-lg">No model loaded</p>
            <p className="text-sm text-gray-500 mt-2">Ask {BRAND.productName} to open a model or select one from Model Creator</p>
          </div>
        )}

        {/* PCBWay Material Selection Modal */}
        {showPCBWayModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="w-[500px] bg-gradient-to-br from-gray-900 to-black border-2 border-green-500/50 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-2xl font-bold text-green-400 mb-4 text-center">
                Ordering from PCBWay
              </h3>
              
              <p className="text-white text-center mb-6">Select Material</p>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                {materials.map((material) => (
                  <button
                    key={material.id}
                    onClick={() => setSelectedMaterial(material.id)}
                    className={`px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedMaterial === material.id
                        ? 'border-green-400 bg-green-500/20 scale-105'
                        : 'border-gray-600 bg-gray-800/50 hover:border-green-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${material.color} border border-white/30`}></div>
                      <span className="text-white font-medium">{material.name}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPCBWayModal(false);
                    setSelectedMaterial(null);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={!selectedMaterial}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-green-500 disabled:hover:to-green-600 shadow-lg shadow-green-500/30"
                >
                  Place Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex gap-4 px-6 py-4 bg-black/50 border-t border-cyan-500/30">
        <button
          onClick={() => alert('3D Print functionality coming soon!')}
          className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>3D Print</span>
        </button>
        
        <button
          onClick={() => setShowPCBWayModal(true)}
          className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-500/30 flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>PCBWay</span>
        </button>
      </div>
    </div>
  );
}



