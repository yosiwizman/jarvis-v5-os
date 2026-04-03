/**
 * Shared camera analysis handler for AKIOR
 * Works with both full AKIOR page and Mini AKIOR assistant
 */

import { getSecuritySocket, type CameraPresence, type SecurityFramePayload } from './socket';
import { buildServerUrl } from './api';
import { readSettings } from '@shared/settings';

interface CameraAnalysisArgs {
  camera_id?: string | null;
  question?: string | null;
}

interface CameraAnalysisResult {
  success: boolean;
  message: string;
  data?: {
    camera?: string;
    timestamp?: number;
    imageUrl?: string;
  };
}

/**
 * Analyze camera view using live camera feed and Realtime API vision
 * @param args Camera analysis parameters
 * @param dataChannel RTCDataChannel for sending image to Realtime API
 * @param onImageCaptured Callback when image is captured (optional, for displaying in UI)
 * @returns Result of the analysis request
 */
export async function handleCameraAnalysis(
  args: CameraAnalysisArgs,
  dataChannel: RTCDataChannel | null,
  onImageCaptured?: (imageUrl: string, caption?: string) => void
): Promise<CameraAnalysisResult> {
  const { camera_id, question } = args;
  
  try {
    console.log('👁️ Analyzing camera view...', args);
    
    // Get the security socket to access camera frames
    const socket = getSecuritySocket();
    
    if (!socket) {
      throw new Error('Security socket not available');
    }
    
    // Trigger scan animation on all connected /holomat clients
    socket.emit('scan:trigger');
    
    // Get list of available cameras
    const cameras = await new Promise<CameraPresence[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for camera list'));
      }, 5000);
      
      const handleList = ({ cameras }: { cameras: CameraPresence[] }) => {
        clearTimeout(timeout);
        socket.off('cameras:list', handleList);
        resolve(cameras);
      };
      
      socket.on('cameras:list', handleList);
      socket.emit('cameras:requestList');
    });
    
    if (cameras.length === 0) {
      return {
        success: false,
        message: 'No cameras are currently available, Sir. Please ensure a camera is connected on the Security page.'
      };
    }
    
    // Pick the camera: use specified ID, or default to first available
    const targetCamera = camera_id 
      ? cameras.find(c => c.cameraId === camera_id)
      : cameras[0];
    
    if (!targetCamera) {
      return {
        success: false,
        message: camera_id 
          ? `Camera "${camera_id}" not found, Sir.`
          : 'No cameras available.'
      };
    }
    
    console.log('📹 Using camera:', targetCamera.friendlyName);
    
    // Subscribe and get the latest frame
    socket.emit('security:subscribe', { cameraId: targetCamera.cameraId });
    
    const frame = await new Promise<SecurityFramePayload>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for camera frame'));
      }, 8000);
      
      const handleFrame = (payload: SecurityFramePayload) => {
        if (payload.cameraId === targetCamera.cameraId) {
          clearTimeout(timeout);
          socket.off('security:frame', handleFrame);
          resolve(payload);
        }
      };
      
      socket.on('security:frame', handleFrame);
    });
    
    console.log('📸 Frame captured from camera');
    
    // Unsubscribe after getting frame
    socket.emit('security:unsubscribe', { cameraId: targetCamera.cameraId });
    
    // Display the captured frame in the UI (if callback provided)
    const timestamp = new Date(frame.ts).toLocaleTimeString();
    const imageDataUrl = `data:image/jpeg;base64,${frame.jpegBase64}`;
    const caption = `📹 ${targetCamera.friendlyName} • ${timestamp}`;
    
    if (onImageCaptured) {
      onImageCaptured(imageDataUrl, caption);
    }
    
    // Auto-save the captured image to files for later reference
    try {
      const saveResponse = await fetch(buildServerUrl('/file-library/store-image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: imageDataUrl,
          filename: `akior-vision-${targetCamera.friendlyName}`,
          prompt: `Camera view from ${targetCamera.friendlyName}`
        })
      });
      
      if (saveResponse.ok) {
        const { filename } = await saveResponse.json();
        console.log('💾 Saved camera frame to files:', filename);
      } else {
        console.warn('⚠️ Failed to save camera frame to files');
      }
    } catch (saveError) {
      console.warn('⚠️ Error saving camera frame:', saveError);
      // Continue anyway - saving is optional
    }
    
    // Send the image through the Realtime API data channel
    if (!dataChannel || dataChannel.readyState !== 'open') {
      throw new Error('No active Realtime connection. Please ensure AKIOR is connected.');
    }
    
    console.log('🔍 Sending image to Realtime API...');
    
    // Create conversation item with image
    const visionPrompt = question || "What do you see in this image? Please describe it in detail.";
    
    // Get image detail setting (defaults to 'low' to save tokens)
    const settings = readSettings();
    const imageDetail = settings.jarvis.imageDetail || 'low';
    
    console.log(`📷 Image detail level: ${imageDetail} (saves tokens on low)`);
    
    const conversationEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: visionPrompt
          },
          {
            type: "input_image",
            image_url: `data:image/jpeg;base64,${frame.jpegBase64}`,
            detail: imageDetail
          }
        ]
      }
    };
    
    dataChannel.send(JSON.stringify(conversationEvent));
    
    // Note: Do NOT send response.create here! The sendFunctionResult handler will do that.
    // Sending it here causes duplicate responses and race conditions.
    
    console.log('✅ Image sent to Realtime API, waiting for function result handler to trigger response...');
    
    // Return success - the model will respond through the audio stream
    return {
      success: true,
      message: 'Analyzing image through camera...',
      data: {
        camera: targetCamera.friendlyName,
        timestamp: frame.ts,
        imageUrl: imageDataUrl
      }
    };
    
  } catch (error) {
    console.error('❌ Error analyzing camera view:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to analyze camera view, Sir.'
    };
  }
}

