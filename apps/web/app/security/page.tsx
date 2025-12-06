'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSecuritySocket, type CameraPresence, type SecurityFramePayload } from '@/lib/socket';

const CAMERA_TTL_MS = 30_000;
const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

type CameraMap = Record<string, CameraPresence>;
type FrameMap = Record<string, SecurityFramePayload>;

function downloadFrame(camera: CameraPresence | undefined, frame: SecurityFramePayload | undefined) {
  if (!camera || !frame) return;
  const link = document.createElement('a');
  link.href = `data:image/jpeg;base64,${frame.jpegBase64}`;
  const safeName = camera.friendlyName.replace(/[^a-z0-9_-]+/gi, '-');
  link.download = `${safeName || camera.cameraId}-${frame.ts}.jpg`;
  document.body?.appendChild(link);
  link.click();
  link.remove();
}

function formatLastSeen(ts: number) {
  const date = new Date(ts);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export default function SecurityPage() {
  const [cameras, setCameras] = useState<CameraMap>({});
  const [frames, setFrames] = useState<FrameMap>({});
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const socketRef = useRef(getSecuritySocket());
  const subscribedRef = useRef(new Set<string>());
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeRtcRoomRef = useRef<string | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
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
      setCameras(() => {
        const next: CameraMap = {};
        incoming.forEach((camera) => {
          next[camera.cameraId] = camera;
        });
        return next;
      });
      ensureSubscriptions(incoming.map((camera) => camera.cameraId));
      setFrames((prev) => {
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
      console.log(`[Security] Camera joined: ${camera.friendlyName} (${camera.cameraId})`);
      setCameras((prev) => ({ ...prev, [camera.cameraId]: camera }));
      ensureSubscriptions([camera.cameraId], true);
    };

    const handleLeft = ({ cameraId }: { cameraId: string }) => {
      console.log(`[Security] Camera left: ${cameraId}`);
      setCameras((prev) => {
        const next = { ...prev };
        delete next[cameraId];
        return next;
      });
      setFrames((prev) => {
        const next = { ...prev };
        delete next[cameraId];
        return next;
      });
      if (subscribedRef.current.has(cameraId)) {
        socket.emit('security:unsubscribe', { cameraId });
        subscribedRef.current.delete(cameraId);
      }
      setSelectedCameraId((current) => (current === cameraId ? null : current));
    };

    const handleFrame = (payload: SecurityFramePayload) => {
      // Log frame receipt (verbose - consider throttling in production)
      // console.log(`[Security] Frame received from ${payload.cameraId}`);
      setFrames((prev) => ({ ...prev, [payload.cameraId]: payload }));
      setCameras((prev) => {
        const next = { ...prev };
        const existing = next[payload.cameraId];
        if (existing) {
          next[payload.cameraId] = { ...existing, lastSeenTs: Date.now() };
        }
        return next;
      });
    };

    const handleConnect = () => {
      console.log('[Security] Socket connected, should receive camera list');
    };

    socket.on('connect', handleConnect);
    socket.on('cameras:list', handleList);
    socket.on('camera:joined', handleJoined);
    socket.on('camera:left', handleLeft);
    socket.on('security:frame', handleFrame);

    // If already connected, request camera list explicitly
    if (socket.connected) {
      console.log('[Security] Socket already connected, requesting camera list');
      socket.emit('cameras:requestList');
    }

    // Poll for reconnection every 5 seconds as a backup
    const pollInterval = setInterval(() => {
      if (!socket.connected) {
        console.log('[Security] Socket disconnected, attempting reconnect');
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
    const socket = socketRef.current;
    if (!socket) return;

    if (!selectedCameraId) {
      if (activeRtcRoomRef.current) {
        socket.emit('leave', { room: activeRtcRoomRef.current });
        activeRtcRoomRef.current = null;
      }
      peerRef.current?.close();
      peerRef.current = null;
      setHasRemoteStream(false);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      pendingIceRef.current = [];
      return;
    }

    const peer = new RTCPeerConnection(RTC_CONFIGURATION);
    peerRef.current = peer;
    setHasRemoteStream(false);
    pendingIceRef.current = [];

    if (activeRtcRoomRef.current && activeRtcRoomRef.current !== selectedCameraId) {
      socket.emit('leave', { room: activeRtcRoomRef.current });
    }
    activeRtcRoomRef.current = selectedCameraId;

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      const video = remoteVideoRef.current;
      if (video && stream) {
        video.srcObject = stream;
        const playPromise = video.play();
        if (playPromise) {
          playPromise.catch(() => undefined);
        }
        setHasRemoteStream(true);
      }
    };

    peer.onicecandidate = (event) => {
      socket.emit('ice', { room: selectedCameraId, candidate: event.candidate ?? null });
    };

    const handlePublisherAnswer = async ({ room, sdp }: { room?: string; sdp: RTCSessionDescriptionInit }) => {
      if (room && room !== selectedCameraId) return;
      try {
        await peer.setRemoteDescription(sdp);
        if (pendingIceRef.current.length > 0) {
          for (const candidate of pendingIceRef.current) {
            await peer.addIceCandidate(candidate);
          }
          pendingIceRef.current = [];
        }
      } catch (err) {
        console.error('Failed to apply publisher answer', err);
      }
    };

    const handleIce = async ({ room, candidate }: { room?: string; candidate: RTCIceCandidateInit | null }) => {
      if (room && room !== selectedCameraId) return;
      if (!candidate) return;
      try {
        if (!peer.remoteDescription) {
          pendingIceRef.current.push(candidate);
          return;
        }
        await peer.addIceCandidate(candidate);
      } catch (err) {
        console.error('Failed to add ICE candidate', err);
      }
    };

    socket.on('publisher-answer', handlePublisherAnswer);
    socket.on('ice', handleIce);

    socket.emit('join', { room: selectedCameraId, role: 'viewer' });

    (async () => {
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        if (peer.localDescription) {
          socket.emit('viewer-offer', { room: selectedCameraId, sdp: peer.localDescription });
        }
      } catch (err) {
        console.error('Failed to create viewer offer', err);
      }
    })();

    return () => {
      socket.off('publisher-answer', handlePublisherAnswer);
      socket.off('ice', handleIce);
      socket.emit('leave', { room: selectedCameraId });
      if (activeRtcRoomRef.current === selectedCameraId) {
        activeRtcRoomRef.current = null;
      }
      peer.close();
      peerRef.current = null;
      setHasRemoteStream(false);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      pendingIceRef.current = [];
    };
  }, [selectedCameraId]);

  const cameraList = useMemo(() => Object.values(cameras).sort((a, b) => a.friendlyName.localeCompare(b.friendlyName)), [cameras]);

  const selectedCamera = selectedCameraId ? cameras[selectedCameraId] : undefined;
  const selectedFrame = selectedCameraId ? frames[selectedCameraId] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Security Dashboard</h1>
          <p className="text-sm text-white/60">Live camera wall with automatic discovery and realtime streaming.</p>
        </div>
      </div>

      {cameraList.length === 0 ? (
        <div className="card p-6 text-center text-sm text-white/60">
          Waiting for camera clients… open the <span className="font-medium text-white">/camera</span> page on another device to start streaming.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {cameraList.map((camera) => {
            const frame = frames[camera.cameraId];
            const offline = now - camera.lastSeenTs > CAMERA_TTL_MS;
            return (
              <div
                key={camera.cameraId}
                className="card cursor-pointer space-y-4 p-4 transition hover:border-sky-500/60"
                onClick={() => setSelectedCameraId(camera.cameraId)}
              >
                <div className="relative overflow-hidden rounded-xl border border-white/5 bg-black/50">
                  {frame ? (
                    <img
                      src={`data:image/jpeg;base64,${frame.jpegBase64}`}
                      alt={camera.friendlyName}
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-video flex items-center justify-center text-sm text-white/50">Awaiting frames…</div>
                  )}
                  <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs">
                    <span className={`h-2 w-2 rounded-full ${offline ? 'bg-red-400' : 'bg-green-400'}`} />
                    <span>{offline ? 'Offline' : 'Live'}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold leading-tight">{camera.friendlyName}</div>
                    <div className="text-xs text-white/40">Last seen {formatLastSeen(camera.lastSeenTs)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn px-3 py-1 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadFrame(camera, frame);
                      }}
                      disabled={!frame}
                    >
                      Save
                    </button>
                    <button
                      className="btn px-3 py-1 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedCameraId(camera.cameraId);
                      }}
                    >
                      Expand
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
          <div className="relative w-full max-w-5xl rounded-3xl border border-white/10 bg-[#0d1117]/95 p-6 shadow-2xl">
            <button
              className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white/70 hover:bg-white/20"
              onClick={() => setSelectedCameraId(null)}
            >
              Close
            </button>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60">
              <video
                ref={remoteVideoRef}
                className={`aspect-video w-full object-cover ${hasRemoteStream ? 'block' : 'hidden'}`}
                playsInline
                autoPlay
                muted
              />
              {!hasRemoteStream && selectedFrame && (
                <img
                  src={`data:image/jpeg;base64,${selectedFrame.jpegBase64}`}
                  alt={selectedCamera.friendlyName}
                  className="aspect-video w-full object-cover"
                />
              )}
              {!hasRemoteStream && !selectedFrame && (
                <div className="aspect-video flex items-center justify-center text-sm text-white/50">
                  Waiting for live stream…
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold">{selectedCamera.friendlyName}</div>
                <div className="text-sm text-white/60">Last seen {formatLastSeen(selectedCamera.lastSeenTs)}</div>
              </div>
              <div className="flex gap-3">
                <button
                  className="btn px-4 py-2 text-sm"
                  onClick={() => downloadFrame(selectedCamera, selectedFrame)}
                  disabled={!selectedFrame}
                >
                  Save snapshot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
