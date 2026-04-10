"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { readSettings } from "@shared/settings";
import { buildServerUrl } from "@/lib/api";
import { getFunctionTools } from "@/lib/jarvis-functions";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { handleCameraAnalysis } from "@/lib/camera-handler";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { SetupRequiredBanner } from "@/components/SetupRequiredBanner";
import AkiorCore from "@/components/akior/AkiorCore";
import type { AkiorState } from "@/components/akior/AkiorCore";

// Dynamically import 3D viewer to avoid SSR issues
const JarvisModelViewer = dynamic(
  () =>
    import("@/components/JarvisModelViewer").then((mod) => ({
      default: mod.JarvisModelViewer,
    })),
  { ssr: false },
);

const FFT_BARS = 64;

/**
 * Dedicated Full-Screen AKIOR Page
 *
 * This page provides a full-screen, always-on AKIOR experience.
 * The visualizer auto-starts when the page loads and runs continuously.
 * No panels, no controls - just the pure AKIOR interface.
 */
export default function JarvisPage() {
  // Setup status - gate connection until setup is complete
  const {
    setupRequired,
    llmConfigured,
    loading: setupLoading,
  } = useSetupStatus();
  const setupComplete = !setupRequired && llmConfigured;

  const [status, setStatus] = useState<
    "idle" | "listening" | "active" | "error"
  >("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [fftData, setFftData] = useState<number[]>(new Array(FFT_BARS).fill(0));
  const [micError, setMicError] = useState<string | null>(null);
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
  // ring rotation refs removed — AkiorLogo handles its own animation
  const router = useRouter();
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const processedCallIdsRef = useRef<Set<string>>(new Set());
  const activeCallsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayContent, setDisplayContent] = useState<{
    type: "image" | "3d";
    url: string;
  } | null>(null);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>(
    "Generating 3D Model",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Connection guards to prevent duplicate connections
  const isConnectingRef = useRef(false);
  const connectionIdRef = useRef<string | null>(null);
  const hasActiveResponseRef = useRef(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch((err) => {
          console.error("Error attempting to enable fullscreen:", err);
        });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false);
        });
      }
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Old FFT wave animation effects removed — AkiorCore handles its own animation

  // Auto-start connection on mount with duplicate prevention
  // GATED: Only starts when setup is complete (PIN + LLM configured)
  useEffect(() => {
    // Wait for setup status to load
    if (setupLoading) {
      console.log("⏳ Waiting for setup status...");
      return;
    }

    // Don't start if setup is incomplete
    if (!setupComplete) {
      console.log(
        "⚠️ Setup incomplete - connection gated. PIN or LLM not configured.",
      );
      return;
    }

    // Prevent duplicate connections (React StrictMode can cause double mounting)
    if (isConnectingRef.current || status !== "idle") {
      console.log(
        "⚠️ Connection already in progress or active, skipping duplicate mount",
      );
      return;
    }

    isConnectingRef.current = true;
    const connectionId = `jarvis-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    connectionIdRef.current = connectionId;

    console.log(`📡 Auto-starting AKIOR... (connection ID: ${connectionId})`);
    startRealtime();

    // Cleanup on unmount
    return () => {
      console.log(
        `🧹 Cleaning up AKIOR connection ${connectionId} on unmount...`,
      );
      const cleanup = endRealtimeRef.current;
      if (cleanup) {
        cleanup();
      }
      // Reset the guard only if this is the active connection
      if (connectionIdRef.current === connectionId) {
        isConnectingRef.current = false;
        connectionIdRef.current = null;
      }
    };
  }, [setupLoading, setupComplete]); // Re-run when setup status changes

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

  // Function execution handlers
  async function executeFunction(name: string, args: any, callId: string) {
    console.log(`Executing function: ${name}`, args);

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
        case "search_files":
          result = await handleSearchFiles(args);
          break;
        case "open_file":
          result = await handleOpenFile(args);
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
            size,
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
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            console.log("📨 Image generation event:", parsed.type);

            if (parsed.type === "final_image" && parsed.image) {
              imageUrl = `data:image/png;base64,${parsed.image}`;
              console.log("✅ Final image received");
            } else if (parsed.type === "error") {
              const errorMsg =
                parsed.error || parsed.message || "Image generation failed";
              console.error("🚨 OpenAI API Error:", errorMsg);
              throw new Error(errorMsg);
            }
          } catch (e) {
            if (e instanceof Error) {
              if (
                e.message.includes("generation failed") ||
                e.message.includes("Image generation failed") ||
                e.message.includes("OpenAI") ||
                e.message.includes("server had an error")
              ) {
                throw e;
              }
            }
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
  }

  async function handleCreate3DModel(args: { prompt: string }) {
    const { prompt } = args;

    try {
      console.log("🎲 Starting 3D model generation...");
      console.log("🎲 Prompt:", prompt);

      setProgressMessage("Generating 3D Model");
      setModelProgress(0);

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

      let attempts = 0;
      const maxAttempts = 1800;
      let lastProgress = -1;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const statusResponse = await fetch(buildServerUrl(`/models/${jobId}`));
        if (!statusResponse.ok) {
          console.error(`❌ Status check failed: ${statusResponse.status}`);
          throw new Error("Failed to check model status");
        }

        const job = await statusResponse.json();

        if (job.progress !== lastProgress) {
          const progressPhase = job.progress < 80 ? "Preview" : "Texturing";
          console.log(
            `🎲 ${progressPhase} | Status: ${job.status}, Progress: ${job.progress}%`,
          );
          lastProgress = job.progress;
        }

        if (typeof job.progress === "number") {
          setModelProgress(job.progress);
        }

        if (job.status === "done") {
          console.log("🎲 Job completed! Outputs:", job.outputs);

          if (!job.outputs) {
            console.error("❌ Job done but no outputs present");
            throw new Error("Model completed but no outputs available");
          }

          const modelUrl =
            job.outputs.glbUrl || job.outputs.objUrl || job.outputs.usdzUrl;

          if (modelUrl) {
            console.log("✅ 3D model URL found:", modelUrl);
            setModelProgress(null);
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

      throw new Error("Model generation timed out after 30 minutes");
    } catch (error) {
      console.error("Error creating 3D model:", error);
      setModelProgress(null);
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

  async function handleSearchFiles(args: { query?: string }) {
    try {
      const response = await fetch(buildServerUrl("/file-library"));
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }

      const data = await response.json();
      const files = Array.isArray(data.files) ? data.files : [];

      // Filter files based on query
      const query = args.query?.toLowerCase() || "";
      const matchingFiles = query
        ? files.filter((f: any) => f.name.toLowerCase().includes(query))
        : files;

      console.log(`🔍 Found ${matchingFiles.length} files matching "${query}"`);

      if (matchingFiles.length === 0) {
        return {
          success: false,
          message: query
            ? `No files found matching "${query}". Try a different search term.`
            : "No files available in the library.",
        };
      }

      // Format file list for AKIOR
      const fileList = matchingFiles.map((f: any) => ({
        name: f.name,
        type: f.category,
        size: f.size,
        extension: f.extension,
      }));

      return {
        success: true,
        message: `Found ${matchingFiles.length} file${matchingFiles.length === 1 ? "" : "s"}: ${fileList.map((f: any) => f.name).join(", ")}`,
        data: { files: fileList },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to search files: ${error.message}`,
      };
    }
  }

  async function handleOpenFile(args: {
    filename: string;
    file_type: "image" | "model" | "other";
  }) {
    const { filename, file_type } = args;

    try {
      console.log(`📂 Opening file: ${filename} (type: ${file_type})`);

      // Set appropriate loading message
      if (file_type === "model") {
        setProgressMessage("Loading 3D Model");
      } else if (file_type === "image") {
        setProgressMessage("Loading Image");
      } else {
        setProgressMessage("Loading File");
      }

      // Simulate loading animation like 3D model generation
      setModelProgress(0);

      // Simulate progress
      for (let i = 0; i <= 100; i += 20) {
        setModelProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setModelProgress(null);

      // Construct the file URL
      const fileUrl = buildServerUrl(`/files/${filename}`);

      // Display the file based on type
      if (file_type === "image") {
        setDisplayContent({ type: "image", url: fileUrl });
        return { success: true, message: `Opening ${filename}` };
      } else if (file_type === "model") {
        setDisplayContent({ type: "3d", url: fileUrl });
        return { success: true, message: `Rendering ${filename}` };
      } else {
        // For other file types, just provide a download link
        window.open(fileUrl, "_blank");
        return { success: true, message: `Opening ${filename} in new tab` };
      }
    } catch (error: any) {
      console.error("Error opening file:", error);
      setModelProgress(null);
      return {
        success: false,
        message: `Failed to open ${filename}: ${error.message}`,
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
        // Display the captured image in the UI
        setDisplayContent({ type: "image", url: imageUrl });
      },
    );
  }

  function sendFunctionResult(callId: string, result: any) {
    console.log(`📤 Attempting to send result for call ${callId}`, {
      success: result.success,
    });

    const originalChannel = activeCallsRef.current.get(callId);
    const currentChannel = dataChannelRef.current;

    // Validate this call belongs to the current connection
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

    // Check if channel is ready
    if (!currentChannel || currentChannel.readyState !== "open") {
      console.warn(
        `⚠️ Data channel not ready (state: ${currentChannel?.readyState || "null"}), cannot send function result for call ${callId}`,
      );
      activeCallsRef.current.delete(callId);
      return;
    }

    // Wait if there's already an active response (race condition prevention)
    if (hasActiveResponseRef.current) {
      console.warn(
        `⚠️ Response already in progress, waiting 200ms before sending result for call ${callId}`,
      );
      setTimeout(() => sendFunctionResult(callId, result), 200);
      return;
    }

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

      // Trigger response from the model
      const responseCreate = {
        type: "response.create",
      };
      currentChannel.send(JSON.stringify(responseCreate));
      hasActiveResponseRef.current = true;
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

  async function startRealtime() {
    try {
      // Double-check we're not already connecting
      if (peerConnectionRef.current || dataChannelRef.current) {
        console.warn("⚠️ Connection already exists, cleaning up first...");
        endRealtime();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setStatus("listening");
      console.log(
        `🎤 Starting AKIOR... (connection: ${connectionIdRef.current})`,
      );

      // Check if media devices are available before requesting
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Media devices not supported in this browser");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          },
        });
        setMicError(null);
      } catch (micErr: any) {
        console.warn(
          "Microphone not available:",
          micErr?.name,
          micErr?.message,
        );
        const msg =
          micErr?.name === "NotFoundError"
            ? "No microphone detected. AKIOR is in standby."
            : micErr?.name === "NotAllowedError" ||
                micErr?.name === "PermissionDeniedError" ||
                micErr?.name === "SecurityError"
              ? "Microphone access denied. Allow mic access to talk to AKIOR."
              : "Microphone unavailable. Check your audio device and browser settings.";
        setMicError(msg);
        setStatus("idle");
        isConnectingRef.current = false;
        return;
      }

      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;
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

      const response = await fetch(buildServerUrl("/openai/realtime"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp, model }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create realtime session");
      }

      await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });

      dc.onopen = () => {
        console.log("WebRTC data channel open");

        // Get all function schemas
        const tools = getFunctionTools();

        // Send session config - NO tool_choice!
        const sessionConfig = {
          type: "session.update",
          session: {
            tools: tools,
            voice: settings.jarvis.voice || "echo",
            instructions: settings.jarvis.initialPrompt || "",
          },
        };

        console.log(
          `Sending session config with ${tools.length} functions:`,
          tools.map((t) => t.name),
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
            hasActiveResponseRef.current = true;
            setHasActiveResponse(true);
            setIsAssistantSpeaking(false);
            console.log("🎤 Response started:", {
              response_id: data.response?.id,
              status: data.response?.status,
            });
          }

          if (data.type === "response.done") {
            hasActiveResponseRef.current = false;
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
        console.log(
          `🧹 Cleanup called for connection: ${connectionIdRef.current}`,
        );

        // Close data channel
        if (dc && dc.readyState === "open") {
          dc.close();
        }

        // Close peer connection
        if (pc && pc.connectionState !== "closed") {
          pc.close();
        }

        // Stop all media tracks
        stream.getTracks().forEach((track) => {
          track.stop();
          console.log(`🛑 Stopped media track: ${track.kind}`);
        });

        // Clear all refs
        remoteStreamRef.current = null;
        dataChannelRef.current = null;
        peerConnectionRef.current = null;
        processedCallIdsRef.current.clear();
        activeCallsRef.current.clear();
        hasActiveResponseRef.current = false;
        setHasActiveResponse(false);
        setIsAssistantSpeaking(false);

        // Reset connection guards
        isConnectingRef.current = false;

        setStatus("idle");
        console.log("✅ Cleanup completed");
      }

      endRealtimeRef.current = cleanup;
    } catch (error) {
      console.error("Error starting AKIOR:", error);
      setStatus("error");

      // Reset connection guards on error
      isConnectingRef.current = false;
      peerConnectionRef.current = null;
      dataChannelRef.current = null;
    }
  }

  function endRealtime() {
    const fn = endRealtimeRef.current;
    if (fn) fn();
  }

  // Map internal status to AkiorCore state
  const akiorState: AkiorState =
    status === "active" && (isAssistantSpeaking || audioLevel > 0.035)
      ? "speaking"
      : status === "active" && (isProcessing || hasActiveResponse)
        ? "thinking"
        : status === "listening" || (status === "active" && !micError)
          ? "listening"
          : "idle";

  const statusLabel =
    akiorState === "speaking"
      ? "speaking"
      : akiorState === "thinking"
        ? "processing"
        : akiorState === "listening"
          ? "listening"
          : "standby";

  const statusMessage = micError
    ? micError
    : akiorState === "speaking"
      ? "AKIOR is responding."
      : akiorState === "thinking"
        ? "AKIOR is processing your request."
        : akiorState === "listening"
          ? status === "listening"
            ? "Opening microphone and session..."
            : "AKIOR is listening."
          : status === "error"
            ? "Connection error. Refresh to retry."
            : "AKIOR is in standby.";

  // Show setup banner if setup is incomplete
  if (!setupLoading && !setupComplete) {
    return (
      <div className="fixed inset-0 left-0 flex items-center justify-center bg-[#0a0a0f]">
        <SetupRequiredBanner />
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-[100dvh] overflow-hidden"
      style={{ background: "#020d1a" }}
    >
      {/* Back to Dashboard - Top Left */}
      <button
        onClick={() => router.push("/menu" as any)}
        className="fixed top-4 left-4 z-50 flex items-center gap-2 px-4 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300/80 hover:text-cyan-200 transition-all"
        title="Back to Dashboard"
        aria-label="Back to Dashboard"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span className="text-xs uppercase tracking-widest">Dashboard</span>
      </button>

      {/* Fullscreen Button - Top Right */}
      <button
        onClick={toggleFullscreen}
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFullscreen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 text-cyan-400/70"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 text-cyan-400/70"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        )}
      </button>

      {/* Fullscreen AKIOR Orb — background layer */}
      {displayContent ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="relative flex h-[480px] w-[480px] items-center justify-center">
            <button
              onClick={() => setDisplayContent(null)}
              className="absolute right-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/50 bg-cyan-500/20 transition-all hover:bg-cyan-500/40"
            >
              <span className="text-2xl font-bold leading-none text-cyan-400">
                &times;
              </span>
            </button>
            {displayContent.type === "image" ? (
              <img
                src={displayContent.url}
                alt="Displayed content"
                className="max-h-full max-w-full object-contain"
              />
            ) : displayContent.type === "3d" ? (
              <div className="h-full w-full">
                <JarvisModelViewer
                  modelUrl={displayContent.url}
                  onError={(error) => {
                    console.error("3D model error:", error);
                    setDisplayContent(null);
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : modelProgress !== null ? (
        <div className="absolute inset-0 z-0">
          <AkiorCore
            state="thinking"
            className="akiorv3--fullscreen"
            size="100vw"
            audioLevel={0}
          />
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center">
            <div className="text-[100px] font-bold leading-none tracking-wider text-white drop-shadow-[0_0_30px_rgba(34,211,238,0.8)]">
              {Math.round(modelProgress)}%
            </div>
            <div className="mt-3 text-base tracking-wide text-cyan-400/70">
              {progressMessage}
            </div>
          </div>
        </div>
      ) : (
        <AkiorCore
          state={akiorState}
          className="akiorv3--fullscreen"
          size="100vw"
          audioLevel={audioLevel}
        />
      )}

      {/* Status UI — overlay at bottom center */}
      <div className="pointer-events-none absolute bottom-12 left-0 right-0 z-10 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full transition-all duration-300 ${
              akiorState === "idle"
                ? "bg-white/30"
                : akiorState === "listening"
                  ? "bg-cyan-400/70 animate-pulse"
                  : akiorState === "speaking" || akiorState === "thinking"
                    ? "bg-cyan-400 animate-pulse"
                    : "bg-red-400/70"
            }`}
          />
          <span className="text-xs font-medium uppercase tracking-widest text-white/40">
            {statusLabel}
          </span>
        </div>
        <p className="max-w-sm text-center text-xs text-white/30">
          {statusMessage}
        </p>
        {status === "active" && (
          <button
            className="pointer-events-auto mt-1 rounded-lg border border-white/10 bg-white/5 px-5 py-1.5 text-xs text-white/50 transition-all duration-200 hover:bg-white/10 hover:text-white/70"
            onClick={endRealtime}
            type="button"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Hidden audio element */}
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
}
