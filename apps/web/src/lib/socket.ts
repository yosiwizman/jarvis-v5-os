import { io, type Socket } from 'socket.io-client';

type RootEvents = {
  'ui:navigate': (payload: { path?: string }) => void;
  'keys:update': (meta: any) => void;
  'lockdown:state': (state: any) => void;
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
  'android:status': (payload: any) => void;
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
  'holomat:openApp': (payload: { appName: string }) => void;
  'holomat:openModel': (payload: { modelUrl: string; modelName?: string }) => void;
  'holomat:command': (payload: any) => void;
};

/**
 * Creates a Socket.IO client that connects to the current page's origin.
 * The dev proxy (dev-proxy.mjs) handles routing /socket.io to the backend.
 * In production, Caddy reverse-proxies /socket.io/* to the server container.
 * 
 * Transport order: websocket first (low latency), polling fallback (reliability).
 * This ensures consistent behavior across all network conditions and proxies.
 */
function createCamerasSocket() {
  return io('/cameras', {
    path: '/socket.io',
    // WebSocket preferred, polling fallback for reliability through proxies
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    // Upgrade from polling to websocket when possible
    upgrade: true,
    // Force new connection on reconnect to avoid stale state
    forceNew: false,
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
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      upgrade: true,
    });
  }
  return rootSocketSingleton;
}

/**
 * Connection state for UI status indicators
 */
export type SocketConnectionState = {
  connected: boolean;
  transport: string | null;
  lastError: string | null;
  reconnectAttempts: number;
};

/**
 * Get the current connection state of a socket.
 * Useful for status displays in the UI.
 */
export function getSocketConnectionState(socket: Socket | null): SocketConnectionState {
  if (!socket) {
    return {
      connected: false,
      transport: null,
      lastError: 'Socket not initialized',
      reconnectAttempts: 0,
    };
  }
  
  return {
    connected: socket.connected,
    transport: socket.io?.engine?.transport?.name ?? null,
    lastError: null, // Socket.IO doesn't expose last error directly
    reconnectAttempts: 0, // Would need to track this manually
  };
}

/**
 * Check if any socket is connected.
 * Useful for global connection status indicators.
 */
export function isAnySocketConnected(): boolean {
  const cameras = cameraSocketSingleton?.connected ?? false;
  const security = securitySocketSingleton?.connected ?? false;
  const root = rootSocketSingleton?.connected ?? false;
  return cameras || security || root;
}
