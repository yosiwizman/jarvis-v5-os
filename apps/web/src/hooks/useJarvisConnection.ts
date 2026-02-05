import { useEffect, useRef, useState, useCallback } from 'react';
import { readSettings } from '@shared/settings';
import { buildServerUrl } from '@/lib/api';
import { getFunctionTools } from '@/lib/jarvis-functions';
import { executeJarvisFunction } from '@/lib/jarvis-function-executor';
import { getCameraSocket } from '@/lib/socket';

export type JarvisStatus = 'idle' | 'listening' | 'active' | 'error';

export interface UseJarvisConnectionOptions {
  autoStart?: boolean;
  onDisplayContent?: (content: { type: 'image' | '3d'; url: string } | null) => void;
  onStatusChange?: (status: JarvisStatus) => void;
}

/**
 * Shared hook for Jarvis WebRTC connection and function execution
 * Used by both the full-screen Jarvis page and the mini floating assistant
 */
export function useJarvisConnection(options: UseJarvisConnectionOptions = {}) {
  const { autoStart = false, onDisplayContent, onStatusChange } = options;
  
  const [status, setStatus] = useState<JarvisStatus>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('Processing');
  
  const statusRef = useRef(status);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const endRealtimeRef = useRef<() => void>(() => undefined);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const processedCallIdsRef = useRef<Set<string>>(new Set());
  const activeCallsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const isConnectingRef = useRef(false);
  const connectionIdRef = useRef<string | null>(null);
  const hasActiveResponseRef = useRef(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    statusRef.current = status;
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Animate processing state
  useEffect(() => {
    if (!isProcessing || modelProgress !== null) return;
    const interval = setInterval(() => {}, 50);
    return () => clearInterval(interval);
  }, [isProcessing, modelProgress]);

  useEffect(() => {
    if (modelProgress === null) return;
    const interval = setInterval(() => {}, 50);
    return () => clearInterval(interval);
  }, [modelProgress]);

  const startRealtime = useCallback(async () => {
    if (isConnectingRef.current) {
      console.log('⏳ Connection already in progress, skipping...');
      return;
    }

    if (statusRef.current === 'active') {
      console.log('✅ Already connected, skipping...');
      return;
    }

    isConnectingRef.current = true;
    const currentConnectionId = `conn-${Date.now()}`;
    connectionIdRef.current = currentConnectionId;

    console.log(`🎤 Starting Jarvis Realtime connection (${currentConnectionId})...`);
    
    // Read settings FRESH every time we connect!
    const settings = readSettings();
    console.log('📋 Using settings:', {
      voice: settings.jarvis.voice,
      model: settings.jarvis.model,
      hasPrompt: !!settings.jarvis.initialPrompt,
      promptLength: settings.jarvis.initialPrompt?.length || 0
    });
    
    setStatus('listening');

    try {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
      }

      processedCallIdsRef.current.clear();
      activeCallsRef.current.clear();
      hasActiveResponseRef.current = false;

      // Check if media devices are available before requesting
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (connectionIdRef.current !== currentConnectionId) {
        console.log('⏹️ Connection cancelled, stopping stream');
        stream.getTracks().forEach((track) => track.stop());
        isConnectingRef.current = false;
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });
      peerConnectionRef.current = pc;

      pc.ontrack = (e) => {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = document.createElement('audio');
          remoteAudioRef.current.autoplay = true;
        }
        const newStream = new MediaStream([e.track]);
        remoteStreamRef.current = newStream;
        remoteAudioRef.current.srcObject = newStream;
      };

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = buildServerUrl('');
      const wsUrl = baseUrl.replace(/^http/, 'ws');

      const sdpResponse = await fetch(`${baseUrl}/openai/realtime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: offer.sdp,
          model: settings.jarvis.model || 'gpt-4o-mini-realtime-preview-2024-12-17'
        }),
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`Realtime session failed: ${sdpResponse.status} - ${errorText}`);
      }

      const payload = await sdpResponse.json();

      if (!payload || !payload.sdp) {
        throw new Error('Invalid SDP response from server');
      }

      if (connectionIdRef.current !== currentConnectionId) {
        console.log('⏹️ Connection cancelled before SDP');
        pc.close();
        stream.getTracks().forEach((track) => track.stop());
        isConnectingRef.current = false;
        return;
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });

      dc.onopen = () => {
        console.log('WebRTC data channel open');
        
        const tools = getFunctionTools();
        
        const sessionConfig = {
          type: 'session.update',
          session: {
            tools: tools,
            voice: settings.jarvis.voice || 'echo',
            instructions: settings.jarvis.initialPrompt || ''
          }
        };
        
        console.log(`Sending session config with ${tools.length} functions:`, tools.map(t => t.name));
        console.log('🎙️ Voice:', sessionConfig.session.voice);
        console.log('📝 Instructions:', sessionConfig.session.instructions?.substring(0, 100) + '...');
        dc.send(JSON.stringify(sessionConfig));

        setStatus('active');
        isConnectingRef.current = false;
      };

      dc.onclose = () => {
        console.log('⚠️ Data channel closed');
        if (statusRef.current === 'active') {
          setStatus('idle');
        }
      };

      dc.onerror = (error) => {
        console.error('❌ Data channel error:', error);
        setStatus('error');
      };

      dc.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'response.audio.delta') {
            hasActiveResponseRef.current = true;
          }

          if (data.type === 'response.done') {
            hasActiveResponseRef.current = false;
          }

          if (data.type === 'response.function_call_arguments.done') {
            const callId = data.call_id;
            const functionName = data.name;
            const args = JSON.parse(data.arguments);

            if (processedCallIdsRef.current.has(callId)) {
              console.log(`⏭️ Skipping duplicate function call: ${callId}`);
              return;
            }

            processedCallIdsRef.current.add(callId);
            activeCallsRef.current.set(callId, dc);

            console.log(`🔧 Executing function: ${functionName}`, args);

            const isModelGeneration = functionName === 'create_3d_model';
            if (!isModelGeneration) {
              setIsProcessing(true);
            }

            try {
              const result = await executeJarvisFunction(functionName, args, {
                setDisplayContent: onDisplayContent,
                setModelProgress,
                setProgressMessage,
                dataChannel: dc
              });

              const currentChannel = activeCallsRef.current.get(callId);
              if (currentChannel && currentChannel.readyState === 'open') {
                currentChannel.send(
                  JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: JSON.stringify(result),
                    },
                  })
                );

                currentChannel.send(JSON.stringify({ type: 'response.create' }));
              }
            } catch (error: any) {
              console.error(`Error executing ${functionName}:`, error);
              const currentChannel = activeCallsRef.current.get(callId);
              if (currentChannel && currentChannel.readyState === 'open') {
                currentChannel.send(
                  JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: JSON.stringify({
                        success: false,
                        message: error.message || 'Function execution failed',
                      }),
                    },
                  })
                );
                currentChannel.send(JSON.stringify({ type: 'response.create' }));
              }
            } finally {
              if (!isModelGeneration) {
                setIsProcessing(false);
              }
              activeCallsRef.current.delete(callId);
            }
          }
        } catch (err) {
          console.error('❌ Error processing data channel message:', err);
        }
      };

      endRealtimeRef.current = () => {
        console.log('🛑 Ending Realtime connection...');
        dc.close();
        pc.close();
        stream.getTracks().forEach((track) => track.stop());
        setStatus('idle');
        connectionIdRef.current = null;
        isConnectingRef.current = false;
        processedCallIdsRef.current.clear();
        activeCallsRef.current.clear();
        hasActiveResponseRef.current = false;
      };
    } catch (error: any) {
      console.error('❌ Failed to start Realtime:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setStatus('error');
      isConnectingRef.current = false;
      connectionIdRef.current = null;
    }
  }, [onDisplayContent]);

  const endRealtime = useCallback(() => {
    endRealtimeRef.current();
  }, []);

  useEffect(() => {
    if (autoStart) {
      console.log('🚀 Auto-starting Jarvis connection...');
      startRealtime();
    }

    return () => {
      // Use statusRef to get current status in cleanup
      if (statusRef.current === 'active') {
        console.log('🛑 Cleaning up Jarvis connection...');
        endRealtime();
      }
    };
  }, [autoStart, startRealtime, endRealtime]);

  return {
    status,
    isProcessing,
    modelProgress,
    progressMessage,
    remoteAudioRef,
    remoteStreamRef,
    startRealtime,
    endRealtime,
  };
}
