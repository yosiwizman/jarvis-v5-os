'use client';

import { useEffect, useRef, useState } from 'react';
import { getCameraSocket } from '@/lib/socket';
import { grabStill } from '@/lib/capture';
import { buildServerUrl } from '@/lib/api';
import { CameraSettings } from '@/components/CameraSettings';

// Camera Diagnostics Component
function CameraDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<{
    isSecureContext: boolean;
    protocol: string;
    hostname: string;
    deviceCount: number | null;
    permissionState: 'prompt' | 'granted' | 'denied' | 'unknown';
    errorMessage: string | null;
  } | null>(null);

  useEffect(() => {
    async function checkDiagnostics() {
      if (typeof window === 'undefined') return;
      
      const result = {
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        deviceCount: null as number | null,
        permissionState: 'unknown' as 'prompt' | 'granted' | 'denied' | 'unknown',
        errorMessage: null as string | null,
      };
      
      // Check permission state if available
      try {
        if ('permissions' in navigator) {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
          result.permissionState = status.state as 'prompt' | 'granted' | 'denied';
        }
      } catch (e) {
        // permissions API not available
      }
      
      // Try to enumerate devices
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          result.deviceCount = devices.filter(d => d.kind === 'videoinput').length;
        }
      } catch (e: any) {
        result.errorMessage = e.message;
      }
      
      setDiagnostics(result);
    }
    
    checkDiagnostics();
  }, []);

  if (!diagnostics) return null;
  
  const isLanWithoutHttps = !diagnostics.isSecureContext && 
    diagnostics.hostname !== 'localhost' && 
    diagnostics.hostname !== '127.0.0.1';

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h3 className="text-lg font-semibold">Camera Diagnostics</h3>
      </div>
      
      <div className="grid gap-3 text-sm">
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <span className="text-white/60">Secure Context (HTTPS)</span>
          <span className={diagnostics.isSecureContext ? 'text-emerald-400' : 'text-amber-400'}>
            {diagnostics.isSecureContext ? '✓ Yes' : '✗ No'}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <span className="text-white/60">Protocol</span>
          <span className="font-mono">{diagnostics.protocol}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <span className="text-white/60">Hostname</span>
          <span className="font-mono">{diagnostics.hostname}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <span className="text-white/60">Camera Permission</span>
          <span className={{
            'granted': 'text-emerald-400',
            'denied': 'text-red-400',
            'prompt': 'text-amber-400',
            'unknown': 'text-white/50'
          }[diagnostics.permissionState]}>
            {diagnostics.permissionState}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <span className="text-white/60">Detected Cameras</span>
          <span>{diagnostics.deviceCount !== null ? diagnostics.deviceCount : 'Unable to detect'}</span>
        </div>
      </div>
      
      {isLanWithoutHttps && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">HTTPS Required for Camera Access</span>
          </div>
          <p className="text-sm text-white/70">
            Browsers require HTTPS to access the camera for security reasons. 
            You're accessing via HTTP on a LAN address.
          </p>
          <div className="text-sm space-y-2">
            <p className="text-white/60">Solutions:</p>
            <ul className="list-disc list-inside text-white/50 space-y-1">
              <li>Access via <code className="bg-white/10 px-1 rounded">https://</code> with a valid certificate</li>
              <li>Use <code className="bg-white/10 px-1 rounded">localhost</code> or <code className="bg-white/10 px-1 rounded">127.0.0.1</code> from the host machine</li>
              <li>Use Tailscale for secure remote access</li>
              <li>Set up a reverse proxy with SSL (e.g., Caddy with automatic HTTPS)</li>
            </ul>
          </div>
        </div>
      )}
      
      {diagnostics.errorMessage && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4">
          <p className="text-sm text-red-400">Error: {diagnostics.errorMessage}</p>
        </div>
      )}
    </div>
  );
}

const STREAM_FPS = 8;
const HEARTBEAT_INTERVAL = 30_000; // 30 seconds - matches socket ping interval
const CAMERA_ID_STORAGE_KEY = 'jarvis.cameraId';
const CAMERA_NAME_STORAGE_KEY = 'jarvis.cameraName';
const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function generateCameraId() {
  if (typeof globalThis !== 'undefined') {
    const cryptoObj = globalThis.crypto || (globalThis as unknown as { msCrypto?: Crypto }).msCrypto;

    if (cryptoObj?.randomUUID) {
      return cryptoObj.randomUUID();
    }

    if (cryptoObj?.getRandomValues) {
      const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const toHex = (value: number) => value.toString(16).padStart(2, '0');
      const hex = Array.from(bytes, toHex).join('');

      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }

  return `cam-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const friendlyNameRef = useRef('');
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [friendlyName, setFriendlyName] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedId = window.localStorage.getItem(CAMERA_ID_STORAGE_KEY) ?? generateCameraId();
    window.localStorage.setItem(CAMERA_ID_STORAGE_KEY, storedId);
    setCameraId(storedId);

    const storedName =
      window.localStorage.getItem(CAMERA_NAME_STORAGE_KEY) ?? `Cam-${storedId.slice(0, 4).toUpperCase()}`;
    window.localStorage.setItem(CAMERA_NAME_STORAGE_KEY, storedName);
    setFriendlyName(storedName);
  }, []);

  useEffect(() => {
    friendlyNameRef.current = friendlyName;
    if (typeof window !== 'undefined' && friendlyName) {
      window.localStorage.setItem(CAMERA_NAME_STORAGE_KEY, friendlyName);
    }
    const socket = getCameraSocket();
    if (socket && cameraId) {
      socket.emit('camera:announce', { cameraId, friendlyName });
    }
  }, [friendlyName, cameraId]);

  useEffect(() => {
    if (!cameraId) {
      return;
    }

    const socket = getCameraSocket();
    if (!socket) {
      return;
    }

    const peer = new RTCPeerConnection(RTC_CONFIGURATION);
    peerRef.current = peer;

    peer.onicecandidate = (event) => {
      socket.emit('ice', { room: cameraId, candidate: event.candidate ?? null });
    };

    socket.emit('join', { room: cameraId, role: 'publisher' });

    const handleViewerOffer = async ({ room, sdp }: { room?: string; sdp: RTCSessionDescriptionInit }) => {
      if (room && room !== cameraId) return;
      try {
        if (!peerRef.current) return;
        const peerConnection = peerRef.current;
        await peerConnection.setRemoteDescription(sdp);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        if (peerConnection.localDescription) {
          socket.emit('publisher-answer', { room: cameraId, sdp: peerConnection.localDescription });
        }
        if (pendingIceRef.current.length > 0) {
          for (const candidate of pendingIceRef.current) {
            await peerConnection.addIceCandidate(candidate);
          }
          pendingIceRef.current = [];
        }
      } catch (err) {
        console.error('Failed to handle viewer offer', err);
      }
    };

    const handleIce = async ({ room, candidate }: { room?: string; candidate: RTCIceCandidateInit | null }) => {
      if (room && room !== cameraId) return;
      if (!candidate) return;
      try {
        const peerConnection = peerRef.current;
        if (!peerConnection) return;
        if (!peerConnection.remoteDescription) {
          pendingIceRef.current.push(candidate);
          return;
        }
        await peerConnection.addIceCandidate(candidate);
      } catch (err) {
        console.error('Failed to add ICE candidate', err);
      }
    };

    socket.on('viewer-offer', handleViewerOffer);
    socket.on('ice', handleIce);

    return () => {
      socket.off('viewer-offer', handleViewerOffer);
      socket.off('ice', handleIce);
      socket.emit('leave', { room: cameraId });
      peerRef.current?.close();
      peerRef.current = null;
      pendingIceRef.current = [];
    };
  }, [cameraId]);

  useEffect(() => {
    if (!cameraId) {
      return;
    }

    const socket = getCameraSocket();
    if (!socket) {
      setError('Unable to connect to the camera server.');
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let frameTimer: number | null = null;
    let heartbeatTimer: number | null = null;

    // Handle socket reconnection - re-announce camera when connection is restored
    const handleConnect = () => {
      console.log('🔌 Socket connected/reconnected');
      // Re-announce camera when socket connects
      socket.emit('camera:announce', { 
        cameraId, 
        friendlyName: friendlyNameRef.current 
      });
      socket.emit('camera:heartbeat', { cameraId, ts: Date.now() });
    };

    const handleDisconnect = (reason: string) => {
      console.log('🔌 Socket disconnected:', reason);
    };

    // Listen for connection events
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // If already connected, announce now
    if (socket.connected) {
      handleConnect();
    }

    const startStream = async () => {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setError('Camera streaming requires a secure (HTTPS) connection or localhost.');
        setStreaming(false);
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 360 },
          audio: false
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = mediaStream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = mediaStream;
          await video.play();
        }

        const [videoTrack] = mediaStream.getVideoTracks();
        trackRef.current = videoTrack;

        const peerConnection = peerRef.current;
        if (peerConnection) {
          const alreadyAdded = peerConnection
            .getSenders()
            .some((sender) => sender.track && sender.track.id === videoTrack.id);
          if (!alreadyAdded) {
            peerConnection.addTrack(videoTrack, mediaStream);
          }
        }

        const canvas = document.createElement('canvas');
        const settings = videoTrack.getSettings();
        canvas.width = (settings.width as number) || 640;
        canvas.height = (settings.height as number) || 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setStreaming(false);
          setError('Unable to initialise the camera canvas.');
          return;
        }

        socket.emit('register', {
          deviceId: cameraId,
          label: friendlyNameRef.current || cameraId,
          caps: { still: true, stream: true }
        });

        socket.emit('camera:announce', { cameraId, friendlyName: friendlyNameRef.current || cameraId });

        const sendFrame = () => {
          if (!videoRef.current) return;
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          const parts = dataUrl.split(',');
          if (parts.length < 2) return;
          const jpegBase64 = parts[1];
          socket.emit('camera:frame', { cameraId, ts: Date.now(), jpegBase64 });
        };

        frameTimer = window.setInterval(sendFrame, Math.round(1000 / STREAM_FPS));
        sendFrame();

        heartbeatTimer = window.setInterval(() => {
          socket.emit('camera:heartbeat', { cameraId, ts: Date.now() });
        }, HEARTBEAT_INTERVAL);
        socket.emit('camera:heartbeat', { cameraId, ts: Date.now() });

        setStreaming(true);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setStreaming(false);
          setError('Unable to access the camera. Please allow camera permissions and try again.');
        }
      }
    };

    startStream();

    const onCapture = (args: { tag: string }) => {
      const track = trackRef.current;
      if (!track) return;
      grabStill(track).then((blob) => {
        const body = new FormData();
        body.set('file', blob, `${cameraId}.jpg`);
        fetch(
          buildServerUrl(`/images/upload?tag=${encodeURIComponent(args.tag)}&deviceId=${cameraId}`),
          {
            method: 'POST',
            body
          }
        );
      });
    };

    socket.on('capture', onCapture);

    return () => {
      cancelled = true;
      socket.off('capture', onCapture);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      if (frameTimer) {
        window.clearInterval(frameTimer);
      }
      if (heartbeatTimer) {
        window.clearInterval(heartbeatTimer);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      trackRef.current = null;
      setStreaming(false);
      socket.emit('camera:bye', { cameraId });
    };
  }, [cameraId]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Camera Client</h1>
        <p className="text-sm text-white/60">
          Stream this device to the security dashboard and respond to capture requests from AKIOR.
        </p>
      </div>

      <div className="card p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="text-xs uppercase tracking-wide text-white/50">Friendly name</span>
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
              value={friendlyName}
              onChange={(event) => setFriendlyName(event.target.value)}
              placeholder="Lobby, Front Door, Studio..."
            />
          </label>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
            <div className="uppercase tracking-wide text-white/40">Camera ID</div>
            <div className="font-mono text-sm break-all">{cameraId ?? '—'}</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <video ref={videoRef} className="aspect-video w-full object-cover" autoPlay muted playsInline />
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs">
            <span className={`h-2 w-2 rounded-full ${streaming ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <span>{streaming ? 'Streaming live' : 'Waiting for video'}</span>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : (
          <p className="text-sm text-white/60">
            Keep this tab open to continue broadcasting. The dashboard will automatically detect this camera and display it live.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Camera Settings</h2>
        <p className="text-sm text-white/60">Configure permissions and Wi‑Fi connection for camera devices.</p>
      </div>
      <CameraSettings />
      
      <CameraDiagnostics />
    </div>
  );
}
