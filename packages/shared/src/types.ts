export type CameraInfo = {
  id: string;
  label?: string;
  caps?: { still: boolean; stream: boolean };
};

export type CaptureRequest = {
  resolution?: string;
  tag: string;
  burst?: boolean;
};

export type CaptureResult = {
  imageId: string;
  deviceId: string;
  url: string;
  ts: number;
};

export type ModelJobStatus = 'queued' | 'running' | 'done' | 'error';

export type ModelJobSource = 'capture' | 'upload' | 'text';

export type ModelJobOutputs = {
  glbUrl?: string;
  fbxUrl?: string;
  objUrl?: string;
  usdzUrl?: string;
  thumbnailUrl?: string;
  textures?: string[];
};

export type ModelJobMetadata = {
  prompt?: string;
  texturePrompt?: string;
  previewTaskId?: string;
  refineTaskId?: string;
};

export type ModelJob = {
  id: string;
  source: ModelJobSource;
  status: ModelJobStatus;
  progress: number;
  createdAt: number;
  updatedAt: number;
  outputs?: ModelJobOutputs;
  metadata?: ModelJobMetadata;
  error?: string;
};

// Camera Settings Configuration
export interface CameraSettings {
  cameraId: string;
  enabled: boolean;
  friendlyName: string;
  motionDetection: {
    enabled: boolean;
    sensitivity: number;  // 1-100
    cooldownSeconds: number;  // seconds between alerts
  };
  motionZones?: MotionZone[];  // future feature
}

export interface MotionZone {
  id: string;
  name: string;
  enabled: boolean;
  coordinates: { x: number; y: number; width: number; height: number };
}

// Lockdown Mode State
export interface LockdownState {
  active: boolean;
  activatedAt: number | null;
  activatedBy: 'manual' | 'auto' | null;
  features: {
    doorsLocked: boolean;
    alarmArmed: boolean;
    camerasSecured: boolean;
  };
}
