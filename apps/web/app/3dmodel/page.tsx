'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, ImageIcon, Sparkles, X, Wifi, type LucideIcon } from 'lucide-react';
import type { ModelJob } from '@shared/types';
import { readSettings, type AppSettings, type ModelSettings } from '@shared/settings';
import { buildServerUrl } from '@/lib/api';
import { grabStill } from '@/lib/capture';
import { getSecuritySocket, type CameraPresence, type SecurityFramePayload } from '@/lib/socket';

type TabKey = 'capture' | 'upload' | 'text';

type MeshySettingsPayload = Pick<
  ModelSettings,
  'aiModel' | 'topology' | 'targetPolycount' | 'shouldRemesh' | 'shouldTexture' | 'enablePbr' | 'symmetryMode' | 'artStyle' | 'outputFormat'
>;

const tabs: {
  key: TabKey;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    key: 'capture',
    label: 'Camera capture',
    description: 'Capture from all available camera devices',
    icon: Camera
  },
  {
    key: 'upload',
    label: 'Upload image',
    description: 'Send your own reference photo',
    icon: ImageIcon
  },
  {
    key: 'text',
    label: 'Text prompt',
    description: 'Imagine an object with pure text',
    icon: Sparkles
  }
];

function getDefaultMeshySettings(settings: AppSettings | null): MeshySettingsPayload {
  const model = settings?.models ?? {};
  return {
    aiModel: model.aiModel ?? 'latest',
    topology: model.topology ?? 'triangle',
    targetPolycount: typeof model.targetPolycount === 'number' ? model.targetPolycount : undefined,
    shouldRemesh: model.shouldRemesh ?? true,
    shouldTexture: model.shouldTexture ?? true,
    enablePbr: model.enablePbr ?? false,
    symmetryMode: model.symmetryMode ?? 'auto',
    artStyle: model.artStyle ?? 'realistic',
    outputFormat: model.outputFormat ?? 'glb'
  };
}

function ModelPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('capture');
  const [job, setJob] = useState<ModelJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [captureTag, setCaptureTag] = useState('default');
  const [triggerCapture, setTriggerCapture] = useState(true);
  const [capturedImages, setCapturedImages] = useState<Array<{ id: string; dataUrl: string; deviceLabel: string }>>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [networkCameras, setNetworkCameras] = useState<Record<string, CameraPresence>>({});
  const [networkFrames, setNetworkFrames] = useState<Record<string, SecurityFramePayload>>({});
  const socketRef = useRef<ReturnType<typeof getSecuritySocket> | null>(null);
  const subscribedRef = useRef(new Set<string>());
  const [uploadImage, setUploadImage] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string>('');
  const [textPrompt, setTextPrompt] = useState('');
  const [texturePrompt, setTexturePrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefilledImageRef = useRef<string | null>(null);

  useEffect(() => {
    setSettings(readSettings());
  }, []);

  // Setup socket connection for network cameras
  useEffect(() => {
    // Create a fresh socket instance for this page
    if (!socketRef.current) {
      socketRef.current = getSecuritySocket();
    }
    const socket = socketRef.current;
    if (!socket) return;

    const ensureSubscriptions = (ids: string[], onlyAdd = false) => {
      const active = subscribedRef.current;
      ids.forEach((id) => {
        if (!active.has(id)) {
          socket.emit('security:subscribe', { cameraId: id });
          active.add(id);
        }
      });
      if (onlyAdd) return;
      for (const id of Array.from(active)) {
        if (!ids.includes(id)) {
          socket.emit('security:unsubscribe', { cameraId: id });
          active.delete(id);
        }
      }
    };

    const handleList = ({ cameras: incoming }: { cameras: CameraPresence[] }) => {
      setNetworkCameras(() => {
        const next: Record<string, CameraPresence> = {};
        incoming.forEach((camera) => {
          next[camera.cameraId] = camera;
        });
        return next;
      });
      ensureSubscriptions(incoming.map((camera) => camera.cameraId));
      setNetworkFrames((prev) => {
        const next = { ...prev };
        const validIds = new Set(incoming.map((camera) => camera.cameraId));
        for (const id of Object.keys(next)) {
          if (!validIds.has(id)) {
            delete next[id];
          }
        }
        return next;
      });
    };

    const handleJoined = (camera: CameraPresence) => {
      setNetworkCameras((prev) => ({ ...prev, [camera.cameraId]: camera }));
      ensureSubscriptions([camera.cameraId], true);
    };

    const handleLeft = ({ cameraId }: { cameraId: string }) => {
      setNetworkCameras((prev) => {
        const next = { ...prev };
        delete next[cameraId];
        return next;
      });
      setNetworkFrames((prev) => {
        const next = { ...prev };
        delete next[cameraId];
        return next;
      });
      if (subscribedRef.current.has(cameraId)) {
        socket.emit('security:unsubscribe', { cameraId });
        subscribedRef.current.delete(cameraId);
      }
    };

    const handleFrame = (payload: SecurityFramePayload) => {
      setNetworkFrames((prev) => ({ ...prev, [payload.cameraId]: payload }));
      setNetworkCameras((prev) => {
        const next = { ...prev };
        const existing = next[payload.cameraId];
        if (existing) {
          next[payload.cameraId] = { ...existing, lastSeenTs: Date.now() };
        }
        return next;
      });
    };

    const handleConnect = () => {
      console.log('[3DModel] Socket connected, should receive camera list');
    };

    socket.on('connect', handleConnect);
    socket.on('cameras:list', handleList);
    socket.on('camera:joined', handleJoined);
    socket.on('camera:left', handleLeft);
    socket.on('security:frame', handleFrame);

    // If already connected, request camera list explicitly
    if (socket.connected) {
      console.log('[3DModel] Socket already connected, requesting camera list');
      socket.emit('cameras:requestList');
    }

    // Poll for updates every 5 seconds as a backup
    const pollInterval = setInterval(() => {
      // Reconnect if disconnected
      if (!socket.connected) {
        console.log('[3DModel] Socket disconnected, attempting reconnect');
        socket.connect();
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      socket.off('connect', handleConnect);
      socket.off('cameras:list', handleList);
      socket.off('camera:joined', handleJoined);
      socket.off('camera:left', handleLeft);
      socket.off('security:frame', handleFrame);
      for (const id of Array.from(subscribedRef.current)) {
        socket.emit('security:unsubscribe', { cameraId: id });
      }
      subscribedRef.current.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (job?.status === 'done') {
      setStatusMessage('Model ready! Open the 3D viewer to explore the result.');
      setIsSubmitting(false);
    }
    if (job?.status === 'error') {
      setIsSubmitting(false);
    }
  }, [job?.status]);

  const defaultMeshySettings = useMemo(() => getDefaultMeshySettings(settings), [settings]);
  const isBusy = job ? job.status === 'queued' || job.status === 'running' : false;
  const sharedImageUrl = searchParams.get('imageUrl');
  const sharedImageName = searchParams.get('imageName');
  
  const networkCameraCount = useMemo(() => {
    const cameraIds = Object.keys(networkCameras);
    const availableCount = cameraIds.filter((id) => networkFrames[id]?.jpegBase64).length;
    return { total: cameraIds.length, available: availableCount };
  }, [networkCameras, networkFrames]);

  useEffect(() => {
    if (!sharedImageUrl || sharedImageUrl === prefilledImageRef.current) {
      return;
    }

    let cancelled = false;

    async function attachSharedImage() {
      if (!sharedImageUrl) return;
      try {
        const resolvedUrl = /^https?:/i.test(sharedImageUrl)
          ? sharedImageUrl
          : buildServerUrl(sharedImageUrl);
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
          throw new Error(`Failed to load shared image (${response.status})`);
        }
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read shared image'));
          reader.readAsDataURL(blob);
        });
        if (cancelled) return;
        prefilledImageRef.current = sharedImageUrl;
        setUploadImage(dataUrl);
        const derivedName =
          sharedImageName ??
          (() => {
            try {
              const parsed = new URL(resolvedUrl);
              const last = parsed.pathname.split('/').filter(Boolean).pop();
              return last ? decodeURIComponent(last) : 'shared-image.png';
            } catch {
              return 'shared-image.png';
            }
          })();
        setUploadName(derivedName);
        setActiveTab('upload');
        setStatusMessage('Image attached from shared files.');
        router.replace('/3dmodel');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load shared image');
        }
      }
    }

    attachSharedImage();

    return () => {
      cancelled = true;
    };
  }, [sharedImageUrl, sharedImageName, router]);

  const pollJob = useCallback((id: string) => {
    async function fetchJob() {
      try {
        const response = await fetch(buildServerUrl(`/models/${id}`));
        if (!response.ok) {
          throw new Error('Failed to fetch job status');
        }
        const payload = (await response.json()) as ModelJob;
        setJob(payload);
        if (payload.status === 'done' || payload.status === 'error') {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          if (payload.status === 'error') {
            setError(payload.error || 'Meshy job failed');
          }
        }
      } catch (err) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setError(err instanceof Error ? err.message : 'Failed to poll job status');
        setIsSubmitting(false);
      }
    }

    fetchJob();
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    pollRef.current = setInterval(fetchJob, 2000);
  }, []);

  const startJob = useCallback(
    async (payload: Omit<CreateModelRequest, 'settings'>, overrides?: Partial<MeshySettingsPayload>) => {
      setError(null);
      setStatusMessage(null);
      setIsSubmitting(true);

      const body: CreateModelRequest = {
        ...payload,
        settings: { ...defaultMeshySettings, ...(overrides ?? {}) }
      };

      try {
        const debugPayload = {
          ...body,
          imageData: body.imageData ? `[base64:${body.imageData.length}]` : undefined
        };
        console.info('[Meshy] Submitting create job request', debugPayload);
        setStatusMessage('Submitting Meshy job request to server…');

        const response = await fetch(buildServerUrl('/models/create'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const rawText = await response.text();
        if (!response.ok) {
          let parsed: any = null;
          try {
            parsed = JSON.parse(rawText);
          } catch (parseError) {
            // ignore
          }
          const details = parsed && typeof parsed === 'object' ? parsed : {};
          const errorMessage = details.error || `Failed to create Meshy job (status ${response.status})`;
          console.error('[Meshy] Create job failed', {
            status: response.status,
            body: rawText,
            parsed
          });
          throw new Error(errorMessage);
        }

        let data: { id: string };
        try {
          data = JSON.parse(rawText) as { id: string };
        } catch (parseError) {
          console.error('[Meshy] Unable to parse job response', { body: rawText, parseError });
          throw new Error('Meshy job created but response was unreadable');
        }

        console.info('[Meshy] Job created successfully', data);
        const now = Date.now();
        const placeholder: ModelJob = {
          id: data.id,
          source: payload.mode,
          status: 'queued',
          progress: 0,
          createdAt: now,
          updatedAt: now
        };
        setJob(placeholder);
        pollJob(data.id);
        setStatusMessage('Meshy job queued. Polling for progress…');
      } catch (err) {
        setIsSubmitting(false);
        setStatusMessage('Failed to create Meshy job.');
        console.error('[Meshy] Unexpected error while creating job', err);
        setError(err instanceof Error ? err.message : 'Unexpected error while creating job');
      }
    },
    [defaultMeshySettings, pollJob]
  );

  async function handleCaptureFromNetworkCameras() {
    setIsCapturing(true);
    setError(null);
    setStatusMessage('Capturing from network cameras...');

    try {
      const cameraIds = Object.keys(networkCameras);
      
      if (cameraIds.length === 0) {
        throw new Error('No network cameras available. Open the /camera page on another device to start streaming.');
      }

      const newImages: Array<{ id: string; dataUrl: string; deviceLabel: string }> = [];

      // Capture the current frame from each network camera
      for (const cameraId of cameraIds) {
        const camera = networkCameras[cameraId];
        const frame = networkFrames[cameraId];

        if (frame && frame.jpegBase64) {
          const dataUrl = `data:image/jpeg;base64,${frame.jpegBase64}`;
          newImages.push({
            id: `${cameraId}-${Date.now()}`,
            dataUrl,
            deviceLabel: camera.friendlyName || cameraId
          });
        }
      }

      if (newImages.length === 0) {
        throw new Error('No frames available from network cameras. Waiting for camera streams...');
      }

      setCapturedImages((prev) => [...prev, ...newImages]);
      setStatusMessage(`Captured ${newImages.length} image(s) from network cameras. Remove any unwanted images and click Generate.`);
    } catch (err) {
      console.error('Network capture failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to capture from network cameras');
      setStatusMessage(null);
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleCaptureFromDeviceCameras() {
    setIsCapturing(true);
    setError(null);
    setStatusMessage('Accessing local camera devices...');

    try {
      // Check for secure context
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        throw new Error('Camera access requires a secure (HTTPS) connection or localhost.');
      }

      // Get all video input devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === 'videoinput');

      if (videoDevices.length === 0) {
        throw new Error('No camera devices found.');
      }

      setStatusMessage(`Found ${videoDevices.length} local camera(s). Capturing images...`);

      const newImages: Array<{ id: string; dataUrl: string; deviceLabel: string }> = [];

      // Capture from each camera device
      for (const device of videoDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: device.deviceId }, width: 1280, height: 720 },
            audio: false
          });

          const [videoTrack] = stream.getVideoTracks();
          
          // Capture still image
          const blob = await grabStill(videoTrack);
          
          // Convert blob to data URL
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read image'));
            reader.readAsDataURL(blob);
          });

          // Stop the track immediately after capture
          videoTrack.stop();
          stream.getTracks().forEach((track) => track.stop());

          const deviceLabel = device.label || `Camera ${newImages.length + 1}`;
          newImages.push({
            id: `${device.deviceId}-${Date.now()}`,
            dataUrl,
            deviceLabel
          });
        } catch (err) {
          console.warn(`Failed to capture from device ${device.label}:`, err);
          // Continue with other cameras even if one fails
        }
      }

      if (newImages.length === 0) {
        throw new Error('Failed to capture images from any camera.');
      }

      setCapturedImages((prev) => [...prev, ...newImages]);
      setStatusMessage(`Captured ${newImages.length} image(s) from local device. Remove any unwanted images and click Generate.`);
    } catch (err) {
      console.error('Device capture failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to capture from device cameras');
      setStatusMessage(null);
    } finally {
      setIsCapturing(false);
    }
  }

  function removeImage(id: string) {
    setCapturedImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function handleGenerateFromCaptures() {
    if (capturedImages.length === 0) {
      setError('Capture at least one image before generating.');
      return;
    }

    // Use upload mode since we're sending base64 image data directly
    // Currently using the first image. To send multiple images to Meshy,
    // the backend would need to be updated to support batch processing
    await startJob({ mode: 'upload', imageData: capturedImages[0].dataUrl });
  }

  async function handleUploadSubmit() {
    if (!uploadImage) {
      setError('Select an image before generating a model.');
      return;
    }
    await startJob({ mode: 'upload', imageData: uploadImage });
  }

  async function handleTextSubmit() {
    if (!textPrompt.trim()) {
      setError('Enter a text prompt to describe your 3D model.');
      return;
    }
    await startJob({ mode: 'text', prompt: textPrompt.trim(), texturePrompt: texturePrompt.trim() || undefined });
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setUploadImage(null);
      setUploadName('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadImage(reader.result as string);
      setUploadName(file.name);
    };
    reader.readAsDataURL(file);
  }

  function getViewerUrl(currentJob: ModelJob) {
    const outputs = currentJob.outputs;
    if (!outputs) return null;

    // Get the model URL based on the outputFormat setting
    const format = defaultMeshySettings.outputFormat || 'glb';
    const formatUrls = {
      glb: outputs.glbUrl,
      obj: outputs.objUrl,
      usdz: outputs.usdzUrl
    };
    
    const modelUrl = formatUrls[format];
    if (!modelUrl) return null;

    const params = new URLSearchParams();
    params.set('modelUrl', modelUrl);
    if (outputs.thumbnailUrl) {
      params.set('thumb', outputs.thumbnailUrl);
    }
    if (currentJob.metadata?.prompt) {
      params.set('title', currentJob.metadata.prompt);
    }
    return `/3dViewer?${params.toString()}`;
  }

  return (
    <div className="space-y-8">
      <section className="card relative overflow-hidden border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/0 p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.4),transparent_60%)]" />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70">
              Meshy workflow
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold md:text-4xl">3D Model Studio</h1>
              <p className="max-w-2xl text-sm text-white/70 md:text-base">
                Orchestrate captures, uploads, and pure imagination into textured meshes powered by Meshy.ai.
                Launch jobs, monitor progress, and jump straight into the 3D viewer when they finish.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-white/50">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />Live pipeline
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-sky-400" />Powered by Meshy.ai
              </span>
            </div>
          </div>
          <dl className="grid w-full gap-3 text-sm text-white/70 md:w-auto md:min-w-[260px]">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner">
              <dt className="text-xs uppercase tracking-wider text-white/50">Default model</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{defaultMeshySettings.aiModel}</dd>
              <dd className="text-xs text-white/50">Configured in Settings</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 shadow-inner">
              <dt className="text-xs uppercase tracking-wider text-white/50">Topology</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{defaultMeshySettings.topology}</dd>
              <dd className="text-xs text-white/50">Target polycount {defaultMeshySettings.targetPolycount ?? 'auto'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <nav aria-label="Generation mode" className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <p className="text-sm text-white/60">
            Choose how you want to brief the model. You can switch tabs at any time&mdash;input state is preserved until you
            generate.
          </p>
          <p className="text-xs text-white/40">{isBusy ? 'Meshy is working on your current job…' : 'Ready when you are.'}</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={isActive}
                className={`group flex-1 min-w-[220px] rounded-2xl border px-4 py-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isActive
                    ? 'border-sky-400/80 bg-sky-400/10 shadow-xl shadow-sky-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                }`}
                onClick={() => setActiveTab(tab.key)}
                disabled={isBusy && activeTab !== tab.key}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                      isActive
                        ? 'border-sky-300/80 bg-sky-400/20 text-sky-100'
                        : 'border-white/10 bg-black/40 text-white/70 group-hover:border-white/25'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="space-y-1">
                    <span className="block text-sm font-semibold text-white">{tab.label}</span>
                    <span className="block text-xs text-white/60">{tab.description}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {activeTab === 'capture' && (
        <section className="card space-y-6 p-8">
          <header className="space-y-1">
            <h2 className="text-2xl font-semibold">Generate from camera capture</h2>
            <p className="text-sm text-white/60">
              Capture images from network cameras or your local device. Remove any unwanted images, then generate your 3D model.
            </p>
          </header>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Wifi className="h-4 w-4" />
                    Network Cameras
                  </h3>
                  <span className="text-xs text-white/50">
                    {networkCameraCount.available > 0 
                      ? `${networkCameraCount.available} ready`
                      : networkCameraCount.total > 0
                      ? `${networkCameraCount.total} waiting for frames`
                      : 'none connected'}
                  </span>
                </div>
                <button
                  className="btn w-full border-sky-500/60 bg-sky-500/80 text-white hover:border-sky-400 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                  disabled={isCapturing || isBusy || isSubmitting || networkCameraCount.available === 0}
                  onClick={handleCaptureFromNetworkCameras}
                >
                  {isCapturing ? 'Capturing...' : 'Capture from network cameras'}
                </button>
                <p className="text-xs text-white/50">
                  Captures from all devices streaming on the /camera page
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Local Device Camera
                  </h3>
                </div>
                <button
                  className="btn w-full border-purple-500/60 bg-purple-500/80 text-white hover:border-purple-400 hover:bg-purple-500"
                  type="button"
                  disabled={isCapturing || isBusy || isSubmitting}
                  onClick={handleCaptureFromDeviceCameras}
                >
                  {isCapturing ? 'Capturing...' : 'Capture from this device'}
                </button>
                <p className="text-xs text-white/50">
                  Accesses the camera(s) on this device (requires permission)
                </p>
              </div>
            </div>
          </div>

          {capturedImages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Captured Images ({capturedImages.length})</h3>
                <button
                  className="btn px-3 py-1 text-xs border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:text-white"
                  onClick={() => setCapturedImages([])}
                  disabled={isBusy || isSubmitting}
                >
                  Clear all
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {capturedImages.map((image) => (
                  <div key={image.id} className="relative group">
                    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      <img
                        src={image.dataUrl}
                        alt={image.deviceLabel}
                        className="aspect-video w-full object-cover"
                      />
                      <button
                        className="absolute right-2 top-2 rounded-full bg-red-500/90 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                        onClick={() => removeImage(image.id)}
                        disabled={isBusy || isSubmitting}
                        aria-label="Remove image"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-white/60 truncate">{image.deviceLabel}</div>
                  </div>
                ))}
              </div>
              <button
                className="btn w-full md:w-auto border-emerald-500/60 bg-emerald-500/80 text-white hover:border-emerald-400 hover:bg-emerald-500"
                type="button"
                disabled={isBusy || isSubmitting || capturedImages.length === 0}
                onClick={handleGenerateFromCaptures}
              >
                {isBusy || isSubmitting ? 'Generating…' : 'Generate 3D Model'}
              </button>
            </div>
          )}
        </section>
      )}

      {activeTab === 'upload' && (
        <section className="card space-y-6 p-8">
          <header className="space-y-1">
            <h2 className="text-2xl font-semibold">Upload an image</h2>
            <p className="text-sm text-white/60">Provide a JPG or PNG of your object. Meshy will reconstruct it in 3D.</p>
          </header>
          <div className="space-y-3">
            <label className="block">
              <div className="text-sm text-white/70 mb-2">Reference image</div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={onFileChange}
                disabled={isBusy || isSubmitting}
                className="block w-full text-sm text-white/70 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-500/20 file:px-4 file:py-2 file:text-white hover:file:bg-sky-500/30"
              />
            </label>
            {uploadImage && (
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <img src={uploadImage} alt="Upload preview" className="h-32 w-32 rounded-xl border border-white/10 object-cover" />
                <div className="text-sm text-white/70">{uploadName}</div>
                <button
                  type="button"
                  className="btn md:ml-auto border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:text-white"
                  onClick={() => {
                    setUploadImage(null);
                    setUploadName('');
                  }}
                  disabled={isBusy || isSubmitting}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          <button
            className="btn w-full md:w-auto border-sky-500/60 bg-sky-500/80 text-white hover:border-sky-400 hover:bg-sky-500"
            type="button"
            onClick={handleUploadSubmit}
            disabled={isBusy || isSubmitting || !uploadImage}
          >
            {isBusy || isSubmitting ? 'Generating…' : 'Generate from image'}
          </button>
        </section>
      )}

      {activeTab === 'text' && (
        <section className="card space-y-6 p-8">
          <header className="space-y-1">
            <h2 className="text-2xl font-semibold">Generate from text prompt</h2>
            <p className="text-sm text-white/60">Meshy will create a base preview mesh and then refine it with textures.</p>
          </header>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Prompt</div>
            <textarea
              className="h-32 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-relaxed focus:border-sky-400/80 focus:outline-none focus:ring-1 focus:ring-sky-400/40"
              placeholder="A cozy reading chair made of warm oak with plush cushions"
              value={textPrompt}
              onChange={(event) => setTextPrompt(event.target.value)}
              disabled={isBusy || isSubmitting}
            />
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Optional texture prompt</div>
            <textarea
              className="h-28 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-relaxed focus:border-sky-400/80 focus:outline-none focus:ring-1 focus:ring-sky-400/40"
              placeholder="Deep emerald velvet upholstery with brass trim"
              value={texturePrompt}
              onChange={(event) => setTexturePrompt(event.target.value)}
              disabled={isBusy || isSubmitting}
            />
            <p className="text-xs text-white/40">Leave blank to rely on the main prompt. Refine stage uses textures unless disabled in Settings.</p>
          </label>
          <div className="text-xs text-white/50">
            Art style: {defaultMeshySettings.artStyle}. Adjust defaults in Settings to change Meshy behaviour.
          </div>
          <button
            className="btn w-full md:w-auto border-sky-500/60 bg-sky-500/80 text-white hover:border-sky-400 hover:bg-sky-500"
            type="button"
            onClick={handleTextSubmit}
            disabled={isBusy || isSubmitting}
          >
            {isBusy || isSubmitting ? 'Generating…' : 'Generate from text'}
          </button>
        </section>
      )}

      {statusMessage && (
        <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100 shadow">
          {statusMessage}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 shadow">
          {error}
        </div>
      )}

      {job && (
        <section className="card space-y-6 p-8">
          <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-white/50">Job #{job.id.slice(0, 8)}</div>
              <div className="text-lg font-semibold">
                {job.status === 'done' && 'Completed'}
                {job.status === 'queued' && 'Queued'}
                {job.status === 'running' && 'In progress'}
                {job.status === 'error' && 'Failed'}
              </div>
              <div className="text-xs text-white/40">Source: {job.source}</div>
            </div>
            {job.outputs?.glbUrl && (
              <button
                type="button"
                className="btn border-sky-500/60 bg-sky-500/80 text-white hover:border-sky-400 hover:bg-sky-500"
                onClick={() => {
                  const url = getViewerUrl(job);
                  if (url) {
                    router.push(url as any);
                  }
                }}
              >
                Open in 3D Viewer
              </button>
            )}
          </header>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-white/60">
              <span>Progress</span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${job.status === 'error' ? 'bg-red-500' : 'bg-sky-400'}`}
                style={{ width: `${Math.max(4, Math.min(100, job.progress))}%` }}
              />
            </div>
          </div>

          {job.status === 'error' && job.error && (
            <div className="text-sm text-red-300">{job.error}</div>
          )}

          {job.outputs && (
            <div className="space-y-3">
              <div className="text-sm font-semibold">Downloads</div>
              <div className="flex flex-wrap gap-3 text-sm">
                {job.outputs.glbUrl && (
                  <a
                    className="btn border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:text-white"
                    href={job.outputs.glbUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GLB
                  </a>
                )}
                {job.outputs.usdzUrl && (
                  <a
                    className="btn border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:text-white"
                    href={job.outputs.usdzUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    USDZ
                  </a>
                )}
                {job.outputs.fbxUrl && (
                  <a
                    className="btn border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:text-white"
                    href={job.outputs.fbxUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    FBX
                  </a>
                )}
                {job.outputs.objUrl && (
                  <a
                    className="btn border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:text-white"
                    href={job.outputs.objUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    OBJ
                  </a>
                )}
              </div>
              {job.outputs.textures && job.outputs.textures.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Texture maps</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {job.outputs.textures.map((texture, index) => (
                      <a
                        key={texture + index}
                        className="truncate text-sm text-blue-300 hover:text-blue-200"
                        href={texture}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {texture}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function ModelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-5xl mx-auto flex items-center justify-center py-20">
          <div className="text-center">
            <div className="h-10 w-10 mx-auto mb-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-white/60">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ModelPageContent />
    </Suspense>
  );
}

type CreateModelRequest = {
  mode: ModelJob['source'];
  captureTag?: string;
  imageData?: string;
  prompt?: string;
  texturePrompt?: string;
  settings: MeshySettingsPayload;
};
