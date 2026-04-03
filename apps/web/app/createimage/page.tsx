'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Settings2, Image as ImageIcon, Zap } from 'lucide-react';
import { buildServerUrl } from '@/lib/api';
import { readSettings, updateImageGenerationSettings, type AppSettings, type ImageGenerationSettings } from '@shared/settings';

type GeneratedImage = {
  type: 'partial' | 'final';
  index?: number;
  dataUrl: string;
  revisedPrompt?: string;
};

type ErrorInfo = {
  message: string;
  type?: 'verification_required' | 'api_error';
};

export default function CreateImagePage() {
  const [prompt, setPrompt] = useState('a futuristic workspace, isometric');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [finalImage, setFinalImage] = useState<GeneratedImage | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSettings(readSettings());
  }, []);

  const imageSettings = useMemo(() => {
    return settings?.imageGeneration ?? {
      model: 'dall-e-3',
      size: '1024x1024',
      quality: 'standard',
      partialImages: 0
    };
  }, [settings]);

  const updateSetting = <K extends keyof ImageGenerationSettings>(
    key: K,
    value: ImageGenerationSettings[K]
  ) => {
    const updates: Partial<ImageGenerationSettings> = { [key]: value };
    
    // Auto-disable streaming for DALL-E models (they don't support it)
    if (key === 'model') {
      const modelValue = value as string;
      if (modelValue === 'dall-e-2' || modelValue === 'dall-e-3') {
        updates.partialImages = 0;
      }
    }
    
    updateImageGenerationSettings(updates);
    setSettings(readSettings());
  };

  async function generate() {
    if (!prompt.trim()) {
      setStatus('Enter a prompt to generate an image.');
      return;
    }

    setIsGenerating(true);
    setStatus('Connecting to OpenAI...');
    setImages([]);
    setFinalImage(null);
    setRevisedPrompt(null);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(buildServerUrl('/openai/generate-image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          settings: imageSettings
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      setStatus('Generating image...');

      let buffer = ''; // Buffer for incomplete lines

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Split by newlines but keep the last incomplete line in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep last (potentially incomplete) line

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          const data = line.slice(6).trim();
          if (!data) continue;
          
          try {
            const parsed = JSON.parse(data);
            console.log('[ImageGen] Received event:', parsed.type, parsed);

            if (parsed.type === 'error') {
              // Handle error event - set error state and break out of loop
              console.error('[ImageGen] Error from backend:', parsed.error);
              setError({
                message: parsed.error || 'Unknown error during generation',
                type: parsed.errorType
              });
              setStatus(null);
              throw new Error(parsed.error || 'Unknown error during generation');
            } else if (parsed.type === 'partial_image') {
                const dataUrl = `data:image/png;base64,${parsed.image}`;
                setImages(prev => {
                  const newImages = [...prev];
                  const existingIndex = newImages.findIndex(
                    img => img.type === 'partial' && img.index === parsed.index
                  );
                  
                  if (existingIndex >= 0) {
                    newImages[existingIndex] = {
                      type: 'partial',
                      index: parsed.index,
                      dataUrl
                    };
                  } else {
                    newImages.push({
                      type: 'partial',
                      index: parsed.index,
                      dataUrl
                    });
                  }
                  
                  return newImages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
                });
                
                setStatus(`Rendering... (partial ${parsed.index + 1})`);
                
              if (parsed.revised_prompt && !revisedPrompt) {
                setRevisedPrompt(parsed.revised_prompt);
              }
            } else if (parsed.type === 'final_image') {
                console.log('[ImageGen] Final image received, length:', parsed.image?.length);
                const dataUrl = `data:image/png;base64,${parsed.image}`;
                console.log('[ImageGen] Created data URL, length:', dataUrl.length);
                
                setFinalImage({
                  type: 'final',
                  dataUrl,
                  revisedPrompt: parsed.revised_prompt
                });
                console.log('[ImageGen] Set final image state');
                
                if (parsed.revised_prompt) {
                  setRevisedPrompt(parsed.revised_prompt);
                }
                
                setStatus('Saving to library...');
                
                // Save to file library
                try {
                  const saveResponse = await fetch(buildServerUrl('/file-library/store-image'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dataUrl, prompt })
                  });
                  
                  if (saveResponse.ok) {
                    const payload = await saveResponse.json();
                    setStatus(`Saved as ${payload.filename ?? 'new image'}`);
                    console.log('[ImageGen] Image saved successfully');
                  } else {
                    setStatus('Image generated but save failed');
                    console.error('[ImageGen] Save failed:', saveResponse.status);
                  }
                } catch (saveError) {
                console.error('[ImageGen] Failed to save image:', saveError);
                setStatus('Image generated but save failed');
              }
            } else if (parsed.type === 'done') {
              setStatus('Complete!');
            }
          } catch (parseError) {
            // Only log parsing errors, not stream errors
            if (parseError instanceof Error && parseError.message.includes('generation')) {
              // This is an error from the stream, re-throw to outer catch
              throw parseError;
            }
            console.error('Failed to parse event:', parseError);
          }
        }
      }
    } catch (err) {
      if ((err as any).name === 'AbortError') {
        setStatus('Generation cancelled');
      } else if (!error) {
        // Only set generic error if we don't already have a specific error
        setError({
          message: err instanceof Error ? err.message : 'Image generation failed',
          type: 'api_error'
        });
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }

  function cancelGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <section className="card relative overflow-hidden border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/0 p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.4),transparent_60%)]" />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70">
              GPT Image Generation
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold md:text-4xl">AI Image Studio</h1>
              <p className="max-w-2xl text-sm text-white/70 md:text-base">
                Generate stunning images using OpenAI's Image API with GPT Image or DALL·E models. 
                Watch your vision materialize in real-time with streaming partial previews.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-white/50">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-violet-400" />Real-time streaming
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-fuchsia-400" />Powered by OpenAI
              </span>
            </div>
          </div>
          <dl className="grid w-full gap-3 text-sm text-white/70 md:w-auto md:min-w-[260px]">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner">
              <dt className="text-xs uppercase tracking-wider text-white/50">Model</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{imageSettings.model}</dd>
              <dd className="text-xs text-white/50">Configured below</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner">
              <dt className="text-xs uppercase tracking-wider text-white/50">Image Size</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{imageSettings.size}</dd>
              <dd className="text-xs text-white/50">Quality: {imageSettings.quality === 'hd' ? 'HD' : 'Standard'}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Settings Panel */}
      <section className="card space-y-6 p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/40">
              <Settings2 className="h-5 w-5 text-white/70" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Generation Settings</h2>
              <p className="text-xs text-white/60">Configure model, size, and quality</p>
            </div>
          </div>
          <button
            type="button"
            className="btn border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70 hover:border-white/30 hover:text-white"
            onClick={() => setShowSettings(!showSettings)}
          >
            {showSettings ? 'Hide' : 'Show'}
          </button>
        </div>

        {showSettings && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-2">
              <div className="text-sm text-white/70">Model</div>
              <select
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-violet-400/80 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
                value={imageSettings.model}
                onChange={(e) => updateSetting('model', e.target.value)}
              >
                <option value="gpt-image-1">gpt-image-1</option>
                <option value="dall-e-3">dall-e-3</option>
                <option value="dall-e-2">dall-e-2</option>
              </select>
            </label>

            <label className="space-y-2">
              <div className="text-sm text-white/70">Size</div>
              <select
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-violet-400/80 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
                value={imageSettings.size}
                onChange={(e) => updateSetting('size', e.target.value as any)}
              >
                <option value="1024x1024">1024×1024 (Square)</option>
                <option value="1024x1536">1024×1536 (Portrait)</option>
                <option value="1536x1024">1536×1024 (Landscape)</option>
              </select>
            </label>

            <label className="space-y-2">
              <div className="text-sm text-white/70">Quality</div>
              <select
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-violet-400/80 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
                value={imageSettings.quality}
                onChange={(e) => updateSetting('quality', e.target.value as any)}
              >
                <option value="standard">Standard</option>
                <option value="hd">HD (High Quality)</option>
              </select>
            </label>

            <label className="space-y-2">
              <div className="text-sm text-white/70">Partial Images</div>
              <select
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-violet-400/80 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
                value={imageSettings.partialImages}
                onChange={(e) => updateSetting('partialImages', Number(e.target.value) as any)}
                disabled={imageSettings.model !== 'gpt-image-1'}
              >
                <option value="0">None (Final only)</option>
                <option value="1">1 preview</option>
                <option value="2">2 previews</option>
                <option value="3">3 previews</option>
              </select>
              {imageSettings.model !== 'gpt-image-1' && (
                <div className="text-xs text-white/50">
                  Streaming only available with gpt-image-1
                </div>
              )}
            </label>
          </div>
        )}
      </section>

      {/* Prompt Input */}
      <section className="card space-y-6 p-8">
        <header className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/40">
            <Sparkles className="h-5 w-5 text-white/70" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Image Prompt</h2>
            <p className="text-xs text-white/60">Describe the image you want to create</p>
          </div>
        </header>

        <div className="space-y-4">
          <textarea
            className="h-32 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed focus:border-violet-400/80 focus:outline-none focus:ring-1 focus:ring-violet-400/40"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A futuristic workspace with holographic displays, isometric view, vibrant colors..."
            disabled={isGenerating}
          />
          
          <div className="flex items-center gap-3">
            {!isGenerating ? (
              <button
                className="btn flex items-center gap-2 border-[color:rgb(var(--akior-accent)_/_0.6)] bg-[color:rgb(var(--akior-accent)_/_0.8)] text-white hover:border-[color:rgb(var(--akior-accent))] hover:bg-[color:rgb(var(--akior-accent))]"
                onClick={generate}
                type="button"
              >
                <Zap className="h-4 w-4" />
                Generate Image
              </button>
            ) : (
              <button
                className="btn flex items-center gap-2 border-red-500/60 bg-red-500/80 text-white hover:border-red-400 hover:bg-red-500"
                onClick={cancelGeneration}
                type="button"
              >
                Cancel
              </button>
            )}
            
            {status && (
              <div className="text-sm text-white/70">
                {isGenerating && (
                  <span className="inline-block mr-2">
                    <svg className="animate-spin h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                )}
                {status}
              </div>
            )}
          </div>

          {revisedPrompt && revisedPrompt !== prompt && (
            <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm">
              <div className="font-semibold text-violet-200">Revised Prompt:</div>
              <div className="mt-1 text-violet-100/80">{revisedPrompt}</div>
            </div>
          )}
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <section className="card p-6">
          {error.type === 'verification_required' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
                  <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-amber-200">Organization Verification Required</h3>
                  <p className="mt-2 text-sm text-white/70">
                    The model <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">{imageSettings.model}</code> requires your OpenAI organization to be verified.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                <div className="text-sm font-semibold text-white">How to verify your organization:</div>
                <ol className="space-y-2 text-sm text-white/70 list-decimal list-inside">
                  <li>
                    Go to{' '}
                    <a 
                      href="https://platform.openai.com/settings/organization/general" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-300 underline"
                    >
                      platform.openai.com → Settings → Organization → General
                    </a>
                  </li>
                  <li>Click the <strong className="text-white">"Verify Organization"</strong> button</li>
                  <li>Complete the verification form (takes just a few minutes)</li>
                  <li>Wait ~15 minutes for access to propagate</li>
                  <li>Return here and try again!</li>
                </ol>
              </div>

              <div className="rounded-xl border border-[color:rgb(var(--akior-accent)_/_0.3)] bg-[color:rgb(var(--akior-accent)_/_0.1)] p-4">
                <div className="text-sm font-semibold akior-accent-text mb-2">💡 Quick Tip</div>
                <p className="text-sm text-white/80">
                  While waiting for verification, you can use <strong>dall-e-3</strong> or <strong>dall-e-2</strong> instead. 
                  These models work immediately without verification!
                </p>
                <button
                  onClick={() => {
                    updateSetting('model', 'dall-e-3');
                    setError(null);
                  }}
                  className="mt-3 btn border-[color:rgb(var(--akior-accent)_/_0.6)] bg-[color:rgb(var(--akior-accent)_/_0.8)] text-white hover:border-[color:rgb(var(--akior-accent))] hover:bg-[color:rgb(var(--akior-accent))] text-sm px-3 py-1.5"
                >
                  Switch to DALL-E 3
                </button>
              </div>

              <div className="text-xs text-white/50">
                <strong>Note:</strong> Verification is free and does not require any spending thresholds. It helps OpenAI ensure the API is used safely while keeping it accessible to developers.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10">
                <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-200">Generation Failed</h3>
                <p className="mt-2 text-sm text-white/70">{error.message}</p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Images Display */}
      {(images.length > 0 || finalImage) && (
        <section className="card space-y-6 p-8">
          <header className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/40">
              <ImageIcon className="h-5 w-5 text-white/70" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Generated Images</h2>
              <p className="text-xs text-white/60">
                {finalImage ? 'Final result ready' : 'Streaming in progress...'}
              </p>
            </div>
          </header>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {images.map((img, idx) => (
              <div key={`partial-${img.index ?? idx}`} className="space-y-2">
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  <img
                    src={img.dataUrl}
                    alt={`Partial ${img.index ?? idx + 1}`}
                    className="w-full"
                  />
                  <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    Partial {(img.index ?? idx) + 1}
                  </div>
                </div>
              </div>
            ))}

            {finalImage && (
              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <div className="relative overflow-hidden rounded-xl border-2 border-violet-400/50 bg-black/20 shadow-xl shadow-violet-500/20">
                  <img
                    src={finalImage.dataUrl}
                    alt="Final generated image"
                    className="w-full"
                  />
                  <div className="absolute left-3 top-3 rounded-full border border-violet-300/30 bg-violet-500/80 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
                    Final Image
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
