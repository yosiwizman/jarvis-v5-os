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
