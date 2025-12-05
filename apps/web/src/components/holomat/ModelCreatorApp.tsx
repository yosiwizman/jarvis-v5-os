'use client';

import { useState, useEffect } from 'react';
import { buildServerUrl } from '@/lib/api';
import dynamic from 'next/dynamic';

// Dynamically import 3D viewer to avoid SSR issues
const JarvisModelViewer = dynamic(
  () => import('@/components/JarvisModelViewer').then(mod => ({ default: mod.JarvisModelViewer })),
  { ssr: false }
);

interface ModelFile {
  name: string;
  url: string;
  type: 'glb' | 'obj' | 'stl';
  size?: string;
}

interface ModelCreatorAppProps {
  onClose: () => void;
}

export function ModelCreatorApp({ onClose }: ModelCreatorAppProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  const [prompt, setPrompt] = useState('');
  const [artStyle, setArtStyle] = useState<'realistic' | 'cartoon' | 'low-poly'>('realistic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedModelUrl, setGeneratedModelUrl] = useState<string | null>(null);
  const [models, setModels] = useState<ModelFile[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load models from file library
  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const response = await fetch(buildServerUrl('/file-library'));
      if (!response.ok) throw new Error('Failed to fetch files');
      
      const data = await response.json();
      const files = Array.isArray(data.files) ? data.files : [];
      
      // Filter for 3D model files
      const modelFiles = files
        .filter((f: any) => ['glb', 'obj', 'stl'].includes(f.extension?.toLowerCase()))
        .map((f: any) => ({
          name: f.name,
          url: buildServerUrl(`/files/${f.name}`),
          type: f.extension.toLowerCase() as 'glb' | 'obj' | 'stl',
          size: f.size
        }));
      
      setModels(modelFiles);
    } catch (err) {
      console.error('Error loading models:', err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setGeneratedModelUrl(null);

    try {
      // Create the 3D model job
      const createResponse = await fetch(buildServerUrl('/models/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'text',
          prompt: prompt.trim(),
          settings: {
            artStyle,
            outputFormat: 'glb'
          }
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create 3D model job');
      }

      const { id: jobId } = await createResponse.json();
      console.log('🎲 Model generation job created:', jobId);

      // Poll for status
      let attempts = 0;
      const maxAttempts = 1800; // 30 minutes

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await fetch(buildServerUrl(`/models/${jobId}`));
        if (!statusResponse.ok) {
          throw new Error('Failed to check model status');
        }

        const job = await statusResponse.json();

        if (typeof job.progress === 'number') {
          setProgress(job.progress);
        }

        if (job.status === 'done') {
          const modelUrl = job.outputs?.glbUrl || job.outputs?.objUrl || job.outputs?.usdzUrl;
          
          if (modelUrl) {
            setGeneratedModelUrl(modelUrl);
            setIsGenerating(false);
            // Refresh the library
            loadModels();
            return;
          } else {
            throw new Error('Model completed but no URL available');
          }
        } else if (job.status === 'error') {
          throw new Error(job.error || 'Model generation failed');
        }

        attempts++;
      }

      throw new Error('Model generation timed out');
    } catch (err) {
      console.error('Model generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate model');
      setIsGenerating(false);
    }
  };

  const handleModelSelect = (model: ModelFile) => {
    setSelectedModel(model);
  };

  return (
    <div className="w-[800px] h-[600px] bg-black/90 backdrop-blur-md rounded-2xl border border-cyan-500/30 flex flex-col overflow-hidden">
        {/* Header */}
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
              <h2 className="text-lg font-semibold text-white">Model Creator</h2>
              <p className="text-xs text-gray-400">Create and manage 3D models</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 flex items-center justify-center transition-all text-red-400"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 py-3 border-b border-cyan-500/20">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'create'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Create Model
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'library'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Model Library
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'create' ? (
            <div className="space-y-4">
              {/* Generated Model Preview */}
              {generatedModelUrl && (
                <div className="w-full h-80 bg-black/50 rounded-xl border border-cyan-500/30 overflow-hidden mb-4">
                  <JarvisModelViewer
                    modelUrl={generatedModelUrl}
                    onError={(error) => {
                      console.error('Model viewer error:', error);
                      setError('Failed to load generated model');
                    }}
                  />
                </div>
              )}

              {/* Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  Describe your 3D model
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., a futuristic spaceship, low poly style"
                  className="w-full h-24 px-4 py-3 bg-black/50 border border-cyan-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                  disabled={isGenerating}
                />
              </div>

              {/* Art Style */}
              <div>
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  Art Style
                </label>
                <div className="flex gap-3">
                  {(['realistic', 'cartoon', 'low-poly'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setArtStyle(style)}
                      disabled={isGenerating}
                      className={`flex-1 px-4 py-2 rounded-lg transition-all capitalize ${
                        artStyle === style
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                          : 'bg-black/50 text-gray-400 border border-gray-700 hover:border-cyan-500/30'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress */}
              {isGenerating && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Generating...</span>
                    <span className="text-cyan-400 font-semibold">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-cyan-500 disabled:hover:to-blue-500"
              >
                {isGenerating ? 'Generating...' : 'Generate 3D Model'}
              </button>
            </div>
          ) : (
            <div>
              {/* Model Library Grid */}
              {models.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <p className="text-gray-400">No 3D models found</p>
                  <p className="text-sm text-gray-500 mt-1">Create your first model to see it here</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {models.map((model) => (
                    <button
                      key={model.url}
                      onClick={() => handleModelSelect(model)}
                      className="aspect-square bg-black/50 border border-cyan-500/30 rounded-xl p-4 hover:border-cyan-500/50 transition-all flex flex-col items-center justify-center gap-2 group"
                    >
                      <svg className="w-12 h-12 text-cyan-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <span className="text-xs text-white font-medium truncate w-full text-center">
                        {model.name}
                      </span>
                      <span className="text-xs text-gray-500 uppercase">
                        {model.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Model Viewer Modal */}
              {selectedModel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <div className="w-[90vw] h-[90vh] max-w-6xl bg-black/90 border border-cyan-500/30 rounded-2xl overflow-hidden flex flex-col">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/30">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{selectedModel.name}</h3>
                        <p className="text-sm text-gray-400 uppercase">{selectedModel.type} Model</p>
                      </div>
                      <button
                        onClick={() => setSelectedModel(null)}
                        className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 flex items-center justify-center transition-all text-red-400"
                      >
                        ×
                      </button>
                    </div>
                    
                    {/* 3D Viewer */}
                    <div className="flex-1">
                      <JarvisModelViewer
                        modelUrl={selectedModel.url}
                        onError={(error) => {
                          console.error('Model viewer error:', error);
                          alert('Failed to load model');
                          setSelectedModel(null);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );
}

