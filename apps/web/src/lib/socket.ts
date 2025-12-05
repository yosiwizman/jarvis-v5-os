import { io, type Socket } from 'socket.io-client';

type RootEvents = {
  'ui:navigate': (payload: { path?: string }) => void;
};

export type CameraPresence = {
  cameraId: string;
  friendlyName: string;
  lastSeenTs: number;
};

export type SecurityFramePayload = {
  cameraId: string;
  ts: number;
  jpegBase64: string;
};

type SessionDescription = {
  type: RTCSdpType;
  sdp: string;
};

type IceCandidatePayload = {
  candidate: RTCIceCandidateInit | null;
  room?: string;
};

type CamerasServerToClientEvents = {
  capture: (payload: { tag: string; resolution?: string }) => void;
  'cameras:list': (payload: { cameras: CameraPresence[] }) => void;
  'camera:joined': (payload: CameraPresence) => void;
  'camera:left': (payload: { cameraId: string }) => void;
  'security:frame': (payload: SecurityFramePayload) => void;
  'viewer-offer': (payload: { room?: string; sdp: SessionDescription }) => void;
  'publisher-answer': (payload: { room?: string; sdp: SessionDescription }) => void;
  ice: (payload: IceCandidatePayload) => void;
  'scan:trigger': () => void;
};

type CamerasClientToServerEvents = {
  register: (payload: { deviceId: string; label?: string; caps?: { still?: boolean; stream?: boolean } }) => void;
  'camera:announce': (payload: { cameraId: string; friendlyName?: string }) => void;
  'camera:frame': (payload: { cameraId: string; ts?: number; jpegBase64: string }) => void;
  'camera:heartbeat': (payload: { cameraId: string; ts?: number }) => void;
  'camera:bye': (payload: { cameraId: string }) => void;
  'cameras:requestList': () => void;
  'security:subscribe': (payload: { cameraId: string }) => void;
  'security:unsubscribe': (payload: { cameraId: string }) => void;
  join: (payload: { room: string; role: 'publisher' | 'viewer' }) => void;
  leave: (payload: { room: string }) => void;
  'viewer-offer': (payload: { room: string; sdp: SessionDescription }) => void;
  'publisher-answer': (payload: { room: string; sdp: SessionDescription }) => void;
  ice: (payload: { room: string; candidate: RTCIceCandidateInit | null }) => void;
  'scan:trigger': () => void;
};

/**
 * Creates a Socket.IO client that connects to the current page's origin.
 * The dev proxy (dev-proxy.mjs) handles routing /socket.io to the backend.
 * This ensures all devices connect to the same server when accessing via the same URL.
 */
function createCamerasSocket() {
  return io<CamerasServerToClientEvents, CamerasClientToServerEvents>('/cameras', {
    path: '/socket.io',
    transports: ['websocket'],
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    // Keep the connection alive with aggressive pings
    pingInterval: 25000,
    pingTimeout: 60000
  });
}

let cameraSocketSingleton: Socket<CamerasServerToClientEvents, CamerasClientToServerEvents> | null = null;
let securitySocketSingleton: Socket<CamerasServerToClientEvents, CamerasClientToServerEvents> | null = null;
let rootSocketSingleton: Socket<RootEvents> | null = null;

export function getCameraSocket() {
  if (!cameraSocketSingleton && typeof window !== 'undefined') {
    cameraSocketSingleton = createCamerasSocket();
  }
  return cameraSocketSingleton;
}

export function getSecuritySocket() {
  if (!securitySocketSingleton && typeof window !== 'undefined') {
    securitySocketSingleton = createCamerasSocket();
    // Ensure the socket connects if not already connected
    if (!securitySocketSingleton.connected) {
      securitySocketSingleton.connect();
    }
  }
  return securitySocketSingleton;
}

export function getRootSocket() {
  if (!rootSocketSingleton && typeof window !== 'undefined') {
    rootSocketSingleton = io('/', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true
    });
  }
  return rootSocketSingleton;
}
