"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { readSettings } from "@shared/settings";
import { buildServerUrl } from "@/lib/api";
import { getFunctionTools } from "@/lib/jarvis-functions";
import { handleCameraAnalysis } from "@/lib/camera-handler";
import { useRouter } from "next/navigation";
import { isFunctionEnabledSync } from "@/hooks/useFunctionSettings";
import AkiorCore from "./akior/AkiorCore";
import type { AkiorState } from "./akior/AkiorCore";

const FFT_BARS = 64;

interface JarvisAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JarvisAssistant({ isOpen, onClose }: JarvisAssistantProps) {
  const [status, setStatus] = useState<
    "idle" | "listening" | "active" | "error"
  >("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [fftData, setFftData] = useState<number[]>(new Array(FFT_BARS).fill(0));
  const [micError, setMicError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState<string | null>(null);
  const [hasActiveResponse, setHasActiveResponse] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const statusRef = useRef(status);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const settings = useMemo(() => readSettings(), []);
  const endRealtimeRef = useRef<() => void>(() => undefined);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const router = useRouter();
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const processedCallIdsRef = useRef<Set<string>>(new Set());
  const activeCallsRef = useRef<Map<string, RTCDataChannel>>(new Map()); // Track which data channel each call belongs to
  const activeJobRef = useRef<string | null>(null); // Track active 3D model job
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayContent, setDisplayContent] = useState<{
    type: "image" | "3d";
    url: string;
    caption?: string;
  } | null>(null);
  const [modelProgress, setModelProgress] = useState<number | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Animate wave pattern when processing (but not for 3D model generation)
  useEffect(() => {
    if (!isProcessing || modelProgress !== null) return;

    const interval = setInterval(() => {
      setFftData((prev) => [...prev]); // Force re-render for wave animation
    }, 50);

    return () => clearInterval(interval);
  }, [isProcessing, modelProgress]);

  // Animate FFT bars for 3D model progress
  useEffect(() => {
    if (modelProgress === null) return;

    const interval = setInterval(() => {
      setFftData((prev) => [...prev]); // Force re-render for progress animation
    }, 50);

    return () => clearInterval(interval);
  }, [modelProgress]);

  // Function execution handlers
  async function executeFunction(name: string, args: any, callId: string) {
    console.log(`Executing function: ${name}`, args);

    // Check if function is enabled
    if (!isFunctionEnabledSync(name)) {
      console.warn(`⚠️ Function ${name} is disabled`);
      sendFunctionResult(callId, {
        success: false,
        message: `The function "${name}" is currently disabled. You can enable it from the Functions page.`,
      });
      return;
    }

    // Store which data channel this call belongs to
    const currentChannel = dataChannelRef.current;
    if (currentChannel) {
      activeCallsRef.current.set(callId, currentChannel);
    }

    // Start loading animation (but not for 3D model generation - it has its own progress)
    const isModelGeneration = name === "create_3d_model";
    if (!isModelGeneration) {
      setIsProcessing(true);
    }

    try {
      let result: any = { success: false, message: "Unknown function" };

      switch (name) {
        case "create_image":
          result = await handleCreateImage(args);
          break;
        case "create_3d_model":
          result = await handleCreate3DModel(args);
          break;
        case "navigate_to_page":
          result = handleNavigate(args);
          break;
        case "list_files":
          result = await handleListFiles();
          break;
        case "capture_images":
          result = await handleCaptureImages(args);
          break;
        case "analyze_camera_view":
          result = await handleAnalyzeCameraView(args);
          break;
        default:
          result = { success: false, message: `Unknown function: ${name}` };
      }

      sendFunctionResult(callId, result);
    } catch (error: any) {
      console.error(`Error executing ${name}:`, error);
      sendFunctionResult(callId, {
        success: false,
        message: error.message || "Function execution failed",
      });
    } finally {
      if (!isModelGeneration) {
        setIsProcessing(false);
      }
      // Clean up the active call tracking
      activeCallsRef.current.delete(callId);
    }
  }

  async function handleCreateImage(args: { prompt: string; size?: string }) {
    const { prompt, size = "1024x1024" } = args;

    try {
      console.log("🎨 Starting image generation:", prompt);
      // Note: isProcessing is managed by executeFunction wrapper

      // Use actual image generation settings from user config
      const imageSettings = settings.imageGeneration || {
        model: "dall-e-3",
        size: "1024x1024",
        quality: "high",
        partialImages: 0,
      };

      const response = await fetch(buildServerUrl("/openai/generate-image"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          settings: {
            ...imageSettings,
            size, // Override with the size from function args if provided
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Image generation error:", errorData);
        throw new Error(
          errorData.error || `Failed to generate image: ${response.statusText}`,
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let imageUrl = "";
      let buffer = ""; // Buffer for incomplete lines

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append chunk to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            console.log("📨 Image generation event:", parsed.type);

            // Handle final image
            if (parsed.type === "final_image" && parsed.image) {
              // Convert base64 to data URL
              imageUrl = `data:image/png;base64,${parsed.image}`;
              console.log("✅ Final image received");
            }
            // Handle partial images (for progress)
            else if (parsed.type === "partial_image" && parsed.image) {
              console.log(`🎨 Partial image ${parsed.index || 0} received`);
            }
            // Handle errors
            else if (parsed.type === "error") {
              const errorMsg =
                parsed.error || parsed.message || "Image generation failed";
              console.error("🚨 OpenAI API Error:", errorMsg);
              throw new Error(errorMsg);
            }
            // Handle done event (just log it)
            else if (parsed.type === "done") {
              console.log("📨 Stream completed");
            }
          } catch (e) {
            if (e instanceof Error) {
              // If it's an actual error (not a parse error), re-throw it
              if (
                e.message.includes("generation failed") ||
                e.message.includes("Image generation failed") ||
                e.message.includes("OpenAI") ||
                e.message.includes("server had an error")
              ) {
                throw e;
              }
            }
            // Log JSON parsing errors for debugging (these are usually incomplete chunks)
            if (e instanceof SyntaxError) {
              console.warn(
                "⚠️ Incomplete SSE chunk (will complete in next chunk):",
                data.substring(0, 100),
              );
            } else {
              console.warn(
                "Failed to parse SSE event:",
                data.substring(0, 100),
                e,
              );
            }
          }
        }
      }

      if (imageUrl) {
        console.log("✅ Image generation completed successfully");
        setDisplayContent({ type: "image", url: imageUrl });
        return { success: true, message: "Here is your image, Sir." };
      } else {
        console.error("❌ No image URL after stream completed");
        throw new Error(
          "No image generated. This may be due to an OpenAI API error. Please try again.",
        );
      }
    } catch (error) {
      console.error("❌ Error creating image:", error);
      // Don't throw if we already have an image displayed (might be a post-processing error)
      if (displayContent?.type === "image") {
        console.warn(
          "⚠️ Error occurred but image was already displayed, ignoring",
        );
        return { success: true, message: "Image created (with minor errors)" };
      }
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create image",
      };
    }
    // Note: isProcessing cleanup is handled by executeFunction wrapper's finally block
  }

  async function handleCreate3DModel(args: { prompt: string }) {
    const { prompt } = args;

    try {
      // Prevent duplicate execution
      if (activeJobRef.current) {
        console.warn(
          `⚠️ Already generating 3D model (job ${activeJobRef.current}), ignoring duplicate request`,
        );
        return {
          success: false,
          message:
            "A 3D model is already being generated. Please wait for it to complete.",
        };
      }

      console.log("🎲 Starting 3D model generation...");
      console.log("🎲 Prompt:", prompt);

      // Set initial progress
      setModelProgress(0);

      // Create the model job
      const createResponse = await fetch(buildServerUrl("/models/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "text",
          prompt,
          settings: {
            artStyle: "realistic",
            outputFormat: "glb",
          },
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `Failed to create 3D model job: ${createResponse.statusText}`,
        );
      }

      const { id: jobId } = await createResponse.json();
      console.log("🎲 Job created:", jobId);

      // Mark this job as active to prevent duplicate execution
      activeJobRef.current = jobId;

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 1800; // 30 minutes with 1 second intervals (text-to-3D can take 15-30 min)
      let lastProgress = -1;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResponse = await fetch(buildServerUrl(`/models/${jobId}`));
        if (!statusResponse.ok) {
          console.error(`❌ Status check failed: ${statusResponse.status}`);
          throw new Error("Failed to check model status");
        }

        const job = await statusResponse.json();

        // Only log if progress changed
        if (job.progress !== lastProgress) {
          const progressPhase = job.progress < 80 ? "Preview" : "Texturing";
          console.log(
            `🎲 ${progressPhase} | Status: ${job.status}, Progress: ${job.progress}%`,
          );
          lastProgress = job.progress;
        }

        // Update progress
        if (typeof job.progress === "number") {
          setModelProgress(job.progress);
        }

        // Check for completion
        if (job.status === "done") {
          console.log("🎲 Job completed! Outputs:", job.outputs);

          if (!job.outputs) {
            console.error("❌ Job done but no outputs present");
            throw new Error("Model completed but no outputs available");
          }

          // Get the first available model URL (prefer GLB)
          const modelUrl =
            job.outputs.glbUrl || job.outputs.objUrl || job.outputs.usdzUrl;

          if (modelUrl) {
            console.log("✅ 3D model URL found:", modelUrl);
            activeJobRef.current = null; // Clear active job
            setModelProgress(null); // Clear progress
            setDisplayContent({ type: "3d", url: modelUrl });
            return {
              success: true,
              message:
                "3D model created successfully, Sir. You can view it on the 3D Viewer page.",
            };
          } else {
            console.error(
              "❌ Job outputs:",
              JSON.stringify(job.outputs, null, 2),
            );
            throw new Error("Model completed but no URL in outputs");
          }
        } else if (job.status === "error") {
          console.error("❌ Job failed with error:", job.error);
          throw new Error(job.error || "Model generation failed");
        }

        attempts++;
      }

      throw new Error("Model generation timed out after 10 minutes");
    } catch (error) {
      console.error("Error creating 3D model:", error);
      activeJobRef.current = null; // Clear active job on error
      setModelProgress(null); // Clear progress on error
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create 3D model",
      };
    }
  }

  function handleNavigate(args: { page: string }) {
    const { page } = args;
    router.push(page as any);

    const pageName = page.split("/").pop() || "page";
    return {
      success: true,
      message: `Opening ${pageName}...`,
    };
  }

  async function handleListFiles() {
    try {
      const response = await fetch(buildServerUrl("/files"));
      const data = await response.json();
      const files = Array.isArray(data) ? data : (data.files ?? []);

      router.push("/files");

      return {
        success: true,
        message: `Found ${files.length} files. Opening files page...`,
        data: files,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to list files: ${error.message}`,
      };
    }
  }

  async function handleCaptureImages(args: { tag?: string | null }) {
    try {
      await fetch(buildServerUrl("/tools/invoke"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "cameras.captureAll",
          args: { tag: args.tag || "akior-capture" },
        }),
      });

      return {
        success: true,
        message: "Capturing images from all cameras...",
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to capture images: ${error.message}`,
      };
    }
  }

  async function handleAnalyzeCameraView(args: {
    camera_id?: string | null;
    question?: string | null;
  }) {
    // Use the shared camera handler that works with live Socket.IO feed
    return await handleCameraAnalysis(
      args,
      dataChannelRef.current,
      (imageUrl, caption) => {
        // Display the captured image in the UI with caption
        setDisplayContent({
          type: "image",
          url: imageUrl,
          caption,
        });
      },
    );
  }

  function sendFunctionResult(callId: string, result: any) {
    console.log(`📤 Attempting to send result for call ${callId}`, {
      success: result.success,
    });

    // Check if this call belongs to the current data channel
    const originalChannel = activeCallsRef.current.get(callId);
    const currentChannel = dataChannelRef.current;

    // If the data channel has changed since the call started, don't send the result
    if (
      originalChannel &&
      currentChannel &&
      originalChannel !== currentChannel
    ) {
      console.warn(
        `⚠️ Data channel changed during function execution for call ${callId}, skipping result to prevent stale call error`,
      );
      activeCallsRef.current.delete(callId);
      return;
    }

    if (!currentChannel || currentChannel.readyState !== "open") {
      console.warn(
        `⚠️ Data channel not ready (state: ${currentChannel?.readyState || "null"}), cannot send function result for call ${callId}`,
      );
      activeCallsRef.current.delete(callId);
      return;
    }

    // Send function result
    const functionResult = {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      },
    };

    console.log(
      `✅ Sending function result for call ${callId}:`,
      functionResult,
    );
    try {
      currentChannel.send(JSON.stringify(functionResult));

      // Trigger response generation
      const responseCreate = {
        type: "response.create",
      };
      currentChannel.send(JSON.stringify(responseCreate));
      console.log(`✅ Function result sent successfully for call ${callId}`);
    } catch (error) {
      console.error(
        `❌ Error sending function result for call ${callId}:`,
        error,
      );
    } finally {
      activeCallsRef.current.delete(callId);
    }
  }

  // Auto-start connection when opened, cleanup when closed.
  // Do NOT auto-retry if setupRequired is set (missing OpenAI key etc) —
  // that would spam the server with 428s and never resolve until config changes.
  useEffect(() => {
    if (isOpen && status === "idle" && !micError && !setupRequired) {
      console.log("📡 Auto-starting WebRTC connection...");
      startRealtime();
    } else if (!isOpen && status !== "idle") {
      console.log("🧹 Cleaning up WebRTC connection (component closed)...");
      const cleanup = endRealtimeRef.current;
      if (cleanup) {
        cleanup();
      }
    }
  }, [isOpen, status, micError, setupRequired]);

  useEffect(() => {
    if (isOpen) {
      setMicError(null);
    }
  }, [isOpen]);

  // Audio level monitoring with FFT
  useEffect(() => {
    if (status !== "active") {
      setAudioLevel(0);
      setFftData(new Array(FFT_BARS).fill(0));
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      return;
    }

    const checkStream = setInterval(() => {
      if (remoteStreamRef.current && statusRef.current === "active") {
        clearInterval(checkStream);
        setupAudioAnalyzer();
      }
    }, 100);

    function setupAudioAnalyzer() {
      if (!remoteStreamRef.current) return;

      try {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(
          remoteStreamRef.current!,
        );
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.5;

        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevel = () => {
          if (analyserRef.current && statusRef.current === "active") {
            analyserRef.current.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;

            let normalizedVolume = Math.min(average / 128, 1);
            normalizedVolume = Math.pow(normalizedVolume, 0.6) * 1.5;
            setAudioLevel(Math.min(normalizedVolume, 1));

            const barData: number[] = [];
            const usefulBins = Math.floor(dataArray.length / 2);
            const samplesPerBar = usefulBins / FFT_BARS;

            for (let i = 0; i < FFT_BARS; i++) {
              let barSum = 0;
              const startIdx = Math.floor(i * samplesPerBar);
              const endIdx = Math.floor((i + 1) * samplesPerBar);

              for (let j = startIdx; j < endIdx; j++) {
                barSum += dataArray[j];
              }
              const normalized = barSum / (endIdx - startIdx) / 255;
              const scaled = Math.pow(normalized, 0.5) * 1.8;
              barData.push(Math.min(scaled, 1));
            }
            setFftData(barData);

            animationFrameRef.current = requestAnimationFrame(updateLevel);
          }
        };

        updateLevel();
      } catch (error) {
        console.error("Failed to setup audio analyzer:", error);
      }
    }

    return () => {
      clearInterval(checkStream);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [status]);

  async function startRealtime() {
    // Hoisted to function scope so the outer catch can clean them up on any
    // thrown error, preventing abandoned RTCPeerConnection / ICE noise that
    // produces the downstream WebSocket close errors the user sees.
    let pcOuter: RTCPeerConnection | null = null;
    let streamOuter: MediaStream | null = null;
    try {
      setStatus("listening");
      setSetupRequired(null);
      let stream: MediaStream | null = null;
      // Retry cascade: preferred constraints → wildcard → explicit deviceId
      // from enumerateDevices. Fixes NotFoundError cases where macOS default
      // input doesn't match specific constraints even though a mic is present.
      const constraintCascade: MediaStreamConstraints[] = [
        {
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          },
        },
        { audio: true }, // wildcard — matches any available input
      ];
      let lastErr: any = null;
      for (const constraints of constraintCascade) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log(
            "[AKIOR mic] acquired stream via constraints:",
            JSON.stringify(constraints),
            "tracks:",
            stream.getAudioTracks().map((t) => ({
              label: t.label,
              id: t.id,
              enabled: t.enabled,
              muted: t.muted,
              state: t.readyState,
            })),
          );
          break;
        } catch (err: any) {
          console.warn(
            "[AKIOR mic] constraint attempt failed:",
            err?.name,
            err?.message,
          );
          lastErr = err;
        }
      }
      // Fallback: enumerate devices and retry with explicit first audioinput
      if (!stream) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter((d) => d.kind === "audioinput");
          console.log(
            "[AKIOR mic] enumerateDevices audioinputs:",
            audioInputs.map((d) => ({
              deviceId: d.deviceId,
              label: d.label,
            })),
          );
          if (audioInputs.length > 0) {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: audioInputs[0].deviceId } },
            });
            console.log(
              "[AKIOR mic] recovered via explicit deviceId:",
              audioInputs[0].label,
            );
          }
        } catch (err: any) {
          console.warn(
            "[AKIOR mic] enumerate/explicit deviceId retry failed:",
            err?.name,
            err?.message,
          );
          lastErr = err;
        }
      }
      if (!stream) {
        const micErr = lastErr;
        const msg =
          micErr?.name === "NotFoundError"
            ? "No microphone detected. Check macOS Sound → Input and browser mic settings."
            : micErr?.name === "NotAllowedError" ||
                micErr?.name === "PermissionDeniedError" ||
                micErr?.name === "SecurityError"
              ? "Microphone access denied. Allow mic access to talk to AKIOR."
              : "Microphone unavailable. Check your audio device and browser settings.";
        setMicError(msg);
        setStatus("idle");
        return;
      }
      setMicError(null);
      const pc = new RTCPeerConnection();
      pcOuter = pc;
      streamOuter = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      pc.ontrack = (ev) => {
        const [remoteStream] = ev.streams;
        remoteStreamRef.current = remoteStream;
        const audio = remoteAudioRef.current;
        if (audio) {
          audio.srcObject = remoteStream;
          audio.play().catch(() => undefined);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const model = settings.jarvis.model || "gpt-realtime-mini";

      let answerSdp: string | undefined;

      if (settings.useServerProxy !== false) {
        const response = await fetch(buildServerUrl("/openai/realtime"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sdp: offer.sdp, model }),
        });

        let payload: any = null;
        try {
          payload = await response.json();
        } catch (error) {
          payload = null;
        }

        if (!response.ok) {
          // Server returns { ok:false, error:{code,message}, setup:{} } for 428 SETUP_REQUIRED,
          // or { error: "<string>" } for other failures. Handle both shapes correctly.
          const errField = payload?.error;
          const extractedMessage =
            typeof errField === "string"
              ? errField
              : errField?.message ||
                payload?.message ||
                "Failed to create realtime session via server proxy";
          const errCode =
            typeof errField === "object" ? errField?.code : undefined;

          if (response.status === 428 || errCode === "SETUP_REQUIRED") {
            // Voice setup (OpenAI Realtime API key) is missing on the server.
            // Surface as a dedicated setup-required state, not a generic error.
            setSetupRequired(
              extractedMessage ||
                "Voice setup required: missing OpenAI API key.",
            );
            setStatus("idle");
            try {
              pc.close();
            } catch {}
            try {
              stream.getTracks().forEach((t) => t.stop());
            } catch {}
            dataChannelRef.current = null;
            return;
          }
          throw new Error(extractedMessage);
        }

        answerSdp = payload?.sdp;
        if (!answerSdp) {
          throw new Error("Realtime session missing SDP from server response");
        }
      } else {
        const directKey = settings.jarvis.apiKey || "";
        if (!directKey) {
          throw new Error(
            "OpenAI API key not configured. Enable the server proxy or add a key locally.",
          );
        }
        const url = new URL("https://api.openai.com/v1/realtime");
        url.searchParams.set("model", model);
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${directKey}`,
            "Content-Type": "application/sdp",
            "OpenAI-Beta": "realtime=v1",
          },
          body: offer.sdp as any,
        });
        const text = await response.text();
        if (!response.ok) {
          throw new Error(text || "Failed to create realtime session");
        }
        answerSdp = text;
      }

      const answer = {
        type: "answer",
        sdp: answerSdp,
      } as RTCSessionDescriptionInit;
      await pc.setRemoteDescription(answer);

      dc.onopen = () => {
        console.log("WebRTC data channel open");

        // Get all function schemas and filter by enabled status
        const allTools = getFunctionTools();
        const enabledTools = allTools.filter((tool) =>
          isFunctionEnabledSync(tool.name),
        );

        console.log(
          `Filtered tools: ${enabledTools.length}/${allTools.length} enabled`,
        );
        if (enabledTools.length < allTools.length) {
          const disabledTools = allTools.filter(
            (tool) => !isFunctionEnabledSync(tool.name),
          );
          console.log(
            `Disabled functions:`,
            disabledTools.map((t) => t.name),
          );
        }

        // Send session config - NO tool_choice!
        const sessionConfig = {
          type: "session.update",
          session: {
            tools: enabledTools,
            voice: settings.jarvis.voice || "echo",
            instructions: settings.jarvis.initialPrompt || "",
          },
        };

        console.log(
          `Sending session config with ${enabledTools.length} enabled functions:`,
          enabledTools.map((t) => t.name),
        );
        console.log("Session config payload:", sessionConfig);
        dc.send(JSON.stringify(sessionConfig));

        setStatus("active");
      };

      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Log incoming events
          console.log("Received event:", data);

          // Log error events in full detail
          if (data.type === "error") {
            console.error("❌ OpenAI Error Event:", data);
            console.error("Error details:", JSON.stringify(data, null, 2));

            // Check for rate limiting
            if (
              data.error?.code === "rate_limit_exceeded" ||
              data.error?.message?.includes("rate limit")
            ) {
              console.error(
                "🚨 RATE LIMIT EXCEEDED - You need to wait before making more requests",
              );
              setStatus("error");
            }
          }

          if (data.type === "session.created") {
            console.log("🎉 Session created successfully");
            console.log(
              "Session details:",
              JSON.stringify(data.session, null, 2),
            );
          }

          if (data.type === "session.updated") {
            console.log("✅ Session updated successfully");
            console.log(
              "Updated session:",
              JSON.stringify(data.session, null, 2),
            );
          }

          // Track response lifecycle
          if (data.type === "response.created") {
            setHasActiveResponse(true);
            setIsAssistantSpeaking(false);
            console.log("🎤 Response started:", {
              response_id: data.response?.id,
              status: data.response?.status,
            });
          }

          if (data.type === "response.done") {
            setHasActiveResponse(false);
            setIsAssistantSpeaking(false);
            console.log("✅ Response completed:", {
              response_id: data.response?.id,
              status: data.response?.status,
              status_details: data.response?.status_details,
              output: data.response?.output,
            });

            // Check for errors in the response
            if (data.response?.status === "failed") {
              console.error(
                "❌ Response failed:",
                data.response?.status_details,
              );
              if (
                data.response?.status_details?.error?.code ===
                "rate_limit_exceeded"
              ) {
                console.error(
                  "🚨 RATE LIMIT EXCEEDED - You are making too many requests",
                );
              }
            }

            // Check if response was cancelled
            if (data.response?.status === "cancelled") {
              console.warn("⚠️ Response was cancelled");
            }

            // Log the full response for debugging
            console.log(
              "Full response.done event:",
              JSON.stringify(data, null, 2),
            );
          }

          // Log audio deltas
          if (data.type === "response.audio.delta") {
            setIsAssistantSpeaking(true);
            console.log("🔊 Receiving audio chunk");
          }

          if (data.type === "response.audio.done") {
            setIsAssistantSpeaking(false);
            console.log("🔊 Audio response completed");
          }

          // Log text deltas
          if (data.type === "response.text.delta") {
            console.log("📝 Receiving text:", data.delta);
          }

          if (data.type === "response.text.done") {
            console.log("📝 Text response completed:", data.text);
          }

          // Handle function calls
          if (data.type === "response.function_call_arguments.done") {
            const callId = data.call_id;
            if (callId && !processedCallIdsRef.current.has(callId)) {
              processedCallIdsRef.current.add(callId);
              console.log("Function call completed:", data);
              if (data.arguments && data.name) {
                try {
                  const args = JSON.parse(data.arguments);
                  executeFunction(data.name, args, callId);
                } catch (parseError) {
                  console.error(
                    "Error parsing function call arguments:",
                    parseError,
                  );
                }
              }
            }
          }
          // Alternative function call format
          else if (
            data.type === "response.output_item.done" &&
            data.item?.type === "function_call"
          ) {
            const item = data.item;
            const callId = item.call_id;
            if (callId && !processedCallIdsRef.current.has(callId)) {
              processedCallIdsRef.current.add(callId);
              console.log("Function call item completed:", data);
              if (item.arguments && item.name) {
                try {
                  const args = JSON.parse(item.arguments);
                  executeFunction(item.name, args, callId);
                } catch (parseError) {
                  console.error(
                    "Error parsing function call arguments:",
                    parseError,
                  );
                }
              }
            }
          }

          // Log rate limit info from response events
          if (data.type === "rate_limits.updated") {
            console.warn(
              "⚠️ Rate limits updated:",
              JSON.stringify(data.rate_limits, null, 2),
            );
          }
        } catch (error) {
          console.error("Error processing data channel message:", error);
        }
      };

      dc.onerror = () => {
        setStatus("error");
      };

      function cleanup() {
        dc.close();
        pc.close();
        stream?.getTracks().forEach((track) => track.stop());
        remoteStreamRef.current = null;
        dataChannelRef.current = null;
        processedCallIdsRef.current.clear();
        activeCallsRef.current.clear(); // Clear active call tracking
        setHasActiveResponse(false);
        setIsAssistantSpeaking(false);
        setStatus("idle");
      }

      endRealtimeRef.current = cleanup;
    } catch (error) {
      console.error("[AKIOR voice] startRealtime failed:", error);
      // Clean up hoisted resources to prevent abandoned peer connections /
      // ICE noise / leaked media tracks on any failure path.
      if (pcOuter) {
        try {
          pcOuter.close();
        } catch {}
      }
      if (streamOuter) {
        try {
          streamOuter.getTracks().forEach((t) => t.stop());
        } catch {}
      }
      dataChannelRef.current = null;
      remoteStreamRef.current = null;
      setStatus("error");
    }
  }

  function endRealtime() {
    const fn = endRealtimeRef.current;
    if (fn) fn();
  }

  function closeAssistant() {
    endRealtime();
    setSetupRequired(null);
    setMicError(null);
    onClose();
  }

  const assistantOrbState: AkiorState =
    status === "active" && (isAssistantSpeaking || audioLevel > 0.035)
      ? "speaking"
      : status === "active" && (isProcessing || hasActiveResponse)
        ? "thinking"
        : status === "listening" || (status === "active" && !micError)
          ? "listening"
          : "idle";

  // Drive surface recipe from orb state: any active voice state → active recipe.
  const assistantSurface: "assistant-standby" | "assistant-active" =
    assistantOrbState === "speaking" ||
    assistantOrbState === "listening" ||
    assistantOrbState === "thinking"
      ? "assistant-active"
      : "assistant-standby";

  const statusLabel = setupRequired
    ? "setup required"
    : status === "error"
      ? "error"
      : assistantOrbState === "speaking"
        ? "speaking"
        : assistantOrbState === "thinking"
          ? "processing"
          : assistantOrbState === "listening"
            ? "listening"
            : "standby";

  const statusMessage = setupRequired
    ? setupRequired
    : micError
      ? micError
      : assistantOrbState === "speaking"
        ? "AKIOR is responding."
        : assistantOrbState === "thinking"
          ? "AKIOR is processing your request."
          : assistantOrbState === "listening"
            ? status === "listening"
              ? "Opening microphone and session..."
              : "AKIOR is listening."
            : status === "error"
              ? "Connection error. Click outside to close."
              : "AKIOR is in standby.";

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#020c1f]/80 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={closeAssistant}
      />

      {/* AKIOR Visualizer — AKIOR owns the full viewport as ambient presence */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="relative w-full h-full flex flex-col items-center justify-center pointer-events-auto animate-[scale-up_0.3s_ease-out]"
          onClick={closeAssistant}
        >
          {/* Legacy FFT radial visualizer removed — compact AkiorCore is now the canonical embedded visual */}
          <div className="hidden">
            <svg
              className="w-2/3 h-2/3"
              viewBox="0 0 400 400"
              style={{ overflow: "visible" }}
            >
              {fftData.map((value, index) => {
                const angle = (index / FFT_BARS) * Math.PI * 2;
                const radius = 180;
                const centerX = 200;
                const centerY = 200;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                const barWidth = 5;
                const baseHeight = 6;

                let barHeight: number;
                let opacity: number;

                // 3D Model generation animation
                if (modelProgress !== null) {
                  // Circular progress animation - bars fill up based on progress
                  const progressAngle = (modelProgress / 100) * Math.PI * 2;
                  const barAngle = (index / FFT_BARS) * Math.PI * 2;
                  const isFilled = barAngle <= progressAngle;

                  // Pulsing effect at the progress edge
                  const isEdge =
                    Math.abs(barAngle - progressAngle) <
                    ((Math.PI * 2) / FFT_BARS) * 2;
                  const pulse = isEdge
                    ? Math.sin(Date.now() / 150) * 0.3 + 0.7
                    : 1;

                  barHeight = isFilled ? baseHeight + 20 * pulse : baseHeight;
                  opacity = isFilled ? 0.9 * pulse : 0.2;
                }
                // Wave animation when processing (image generation)
                else if (isProcessing) {
                  const waveOffset =
                    Math.sin(Date.now() / 200 + index * 0.3) * 15;
                  barHeight = baseHeight + Math.abs(waveOffset);
                  opacity = 0.6 + (Math.abs(waveOffset) / 15) * 0.4;
                }
                // Normal audio visualization
                else {
                  barHeight = baseHeight + value * 25;
                  opacity = status === "active" ? 0.4 + value * 0.6 : 0.1;
                }

                const rotation = (angle * 180) / Math.PI + 90;

                return (
                  <g
                    key={index}
                    transform={`translate(${x}, ${y}) rotate(${rotation})`}
                  >
                    <rect
                      x={-barWidth / 2}
                      y={-barHeight / 2}
                      width={barWidth}
                      height={barHeight}
                      fill="#22d3ee"
                      opacity={opacity}
                      rx={2.5}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Logo or Display Content or Progress - Center */}
          {displayContent ? (
            <div className="relative z-10 w-96 h-96 bg-black/50 backdrop-blur-sm rounded-2xl border border-cyan-500/30 p-4 flex items-center justify-center">
              {/* Close Button */}
              <button
                onClick={() => setDisplayContent(null)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/50 flex items-center justify-center transition-all z-20"
              >
                <span className="text-cyan-400 text-lg font-bold">×</span>
              </button>

              {/* Display Content */}
              {displayContent.type === "image" ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <img
                    src={displayContent.url}
                    alt="Generated content"
                    className="max-w-full max-h-[85%] object-contain rounded-lg"
                  />
                  {displayContent.caption && (
                    <p className="text-cyan-400 text-sm text-center px-2">
                      {displayContent.caption}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-cyan-400 text-center">
                  <p className="mb-4">3D Model Created</p>
                  <a
                    href={displayContent.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-xl inline-block"
                  >
                    View Model
                  </a>
                </div>
              )}
            </div>
          ) : modelProgress !== null ? (
            // 3D Model Generation Progress
            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="text-white text-[120px] font-bold leading-none tracking-wider drop-shadow-[0_0_30px_rgba(34,211,238,0.8)]">
                {Math.round(modelProgress)}%
              </div>
              <div className="text-cyan-400 text-xl mt-4 tracking-wide">
                Generating 3D Model
              </div>
            </div>
          ) : (
            <div
              className="relative z-10 flex items-center justify-center w-[min(1400px,92vw)]"
              data-testid="brand-mark"
            >
              <AkiorCore
                state={assistantOrbState}
                size="100%"
                audioLevel={audioLevel}
                surface={assistantSurface}
              />
            </div>
          )}

          {/* Legacy status ring glow removed — compact AkiorCore carries its own audio-reactive glow */}

          {/* Status Info — pinned to bottom so the orb owns the center */}
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-center space-y-3 w-full max-w-md px-4">
            <div className="flex items-center justify-center gap-3">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  assistantOrbState === "idle"
                    ? "bg-gray-500"
                    : assistantOrbState === "listening"
                      ? "bg-cyan-400/70 animate-pulse"
                      : assistantOrbState === "speaking" ||
                          assistantOrbState === "thinking"
                        ? "bg-cyan-400 animate-pulse"
                        : "bg-red-500"
                }`}
              />
              <span className="text-xl font-semibold text-cyan-400 uppercase tracking-wider">
                {statusLabel}
              </span>
            </div>

            <p className="text-sm text-white/60 max-w-md px-4 mx-auto">
              {statusMessage}
            </p>

            {status === "active" && (
              <button
                className="px-6 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 transition-all duration-200 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                onClick={(e) => {
                  e.stopPropagation();
                  endRealtime();
                }}
                type="button"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <style jsx global>{`
        @keyframes scale-up {
          from {
            transform: scale(0.1) translate(200%, 200%);
            opacity: 0;
          }
          to {
            transform: scale(1) translate(0, 0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

interface JarvisIconProps {
  onClick: () => void;
}

export function JarvisIcon({ onClick }: JarvisIconProps) {
  return (
    <button
      onClick={onClick}
      className="group fixed bottom-6 right-6 z-10 transition-transform duration-200 hover:scale-105"
      aria-label="Open AKIOR Assistant"
      data-testid="brand-float"
      style={{
        pointerEvents: "auto",
        width: 120,
        height: 120,
        borderRadius: "9999px",
        background:
          "radial-gradient(circle at 50% 50%, rgba(27,210,255,0.26) 0%, rgba(0,170,255,0.12) 42%, rgba(2,12,31,0) 74%)",
        border: "none",
        padding: 0,
        position: "fixed",
      }}
    >
      {/* Mini-AKIOR living launcher: rings (counter-rotating) + core pulse + emblem breath */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {/* Rings copy A — slow forward rotation */}
        <img
          src="/akior/layers/akior_layer_rings.svg"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 0.55,
            mixBlendMode: "screen",
            animation: "akiorSpinSlow 28s linear infinite",
            transformOrigin: "50% 36%",
            filter:
              "drop-shadow(0 0 6px rgba(99,246,255,0.55)) drop-shadow(0 0 14px rgba(99,246,255,0.3))",
          }}
        />
        {/* Rings copy B — reverse counter-rotation */}
        <img
          src="/akior/layers/akior_layer_rings.svg"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 0.32,
            mixBlendMode: "screen",
            animation: "akiorSpinSlow 44s linear infinite reverse",
            transformOrigin: "50% 36%",
          }}
        />
        {/* Core — pulsing bright center */}
        <img
          src="/akior/layers/akior_layer_core.svg"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 0.9,
            mixBlendMode: "screen",
            filter:
              "drop-shadow(0 0 8px rgba(99,246,255,0.7)) drop-shadow(0 0 18px rgba(99,246,255,0.4))",
            animation: "akiorCorePulse 2.4s ease-in-out infinite",
            transformOrigin: "50% 36%",
          }}
        />
        {/* Emblem — sacred geometry (breathe) */}
        <img
          src="/akior/layers/akior_layer_emblem.svg"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 0.98,
            mixBlendMode: "screen",
            filter:
              "drop-shadow(0 0 6px rgba(99,246,255,0.9)) drop-shadow(0 0 16px rgba(99,246,255,0.5)) drop-shadow(0 0 34px rgba(99,246,255,0.32))",
            animation: "akiorBreathe 5.2s ease-in-out infinite",
            transformOrigin: "50% 36%",
          }}
        />
      </div>
    </button>
  );
}
