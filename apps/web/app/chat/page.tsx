"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  readSettings,
  type TextChatSettings,
  isIntegrationConnected,
} from "@shared/settings";
import { buildServerUrl } from "@/lib/api";
import { getFunctionTools } from "@/lib/jarvis-functions";
import { useRouter } from "next/navigation";
import {
  getSecuritySocket,
  type CameraPresence,
  type SecurityFramePayload,
} from "@/lib/socket";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "function";
  content: string;
  status?: "pending" | "error" | "executing";
  functionName?: string;
  imageUrl?: string;
  source?: "local-llm" | "cloud" | null;
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [chatSettings, setChatSettings] = useState<TextChatSettings>(
    () => readSettings().textChat,
  );
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null,
  );
  const [conversationId, setConversationId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "smartMirrorSettings") {
        setChatSettings(readSettings().textChat);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const activeModel = useMemo(
    () => chatSettings?.model || "gpt-5",
    [chatSettings?.model],
  );
  const activeReasoning = useMemo(
    () => chatSettings?.reasoningEffort || "low",
    [chatSettings?.reasoningEffort],
  );
  const activeVerbosity = useMemo(
    () => chatSettings?.verbosity || "medium",
    [chatSettings?.verbosity],
  );

  // Record action to backend
  const recordAction = useCallback(async (type: string, metadata: any) => {
    try {
      await fetch(buildServerUrl("/api/actions/record"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          source: "user",
          metadata,
        }),
      });
      console.log(`📊 Action recorded: ${type}`);
    } catch (error) {
      console.error(`❌ Error recording action (${type}):`, error);
    }
  }, []);

  // Function execution handlers (same as JarvisAssistant)
  async function executeFunction(
    name: string,
    args: any,
  ): Promise<{
    success: boolean;
    message: string;
    data?: any;
    imageUrl?: string;
  }> {
    console.log(`Executing function: ${name}`, args);

    try {
      switch (name) {
        case "create_image":
          return await handleCreateImage(args);
        case "create_3d_model":
          return await handleCreate3DModel(args);
        case "navigate_to_page":
          return handleNavigate(args);
        case "list_files":
          return await handleListFiles();
        case "capture_images":
          return await handleCaptureImages(args);
        case "analyze_camera_view":
          return await handleAnalyzeCameraView(args);
        case "recall_memory":
          return await handleRecallMemory(args);
        default:
          return { success: false, message: `Unknown function: ${name}` };
      }
    } catch (error: any) {
      console.error(`Error executing ${name}:`, error);
      return {
        success: false,
        message: error.message || "Function execution failed",
      };
    }
  }

  async function handleCreateImage(args: { prompt: string; size?: string }) {
    const { prompt, size = "1024x1024" } = args;

    try {
      console.log("🎨 Starting image generation:", prompt);

      const imageSettings = (chatSettings as any).imageGeneration ||
        (readSettings() as any).imageGeneration || {
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
            if (
              e instanceof Error &&
              (e.message.includes("generation failed") ||
                e.message.includes("Image generation failed") ||
                e.message.includes("OpenAI") ||
                e.message.includes("server had an error"))
            ) {
              throw e;
            }
          }
        }
      }

      if (imageUrl) {
        console.log("✅ Image generation completed successfully");
        // Record action
        recordAction("image_generated", {
          prompt,
          size,
          model: imageSettings.model,
        });
        return {
          success: true,
          message: "I've created your image. Here it is:",
          imageUrl,
        };
      } else {
        console.error("❌ No image URL after stream completed");
        throw new Error(
          "No image generated. This may be due to an OpenAI API error. Please try again.",
        );
      }
    } catch (error) {
      console.error("❌ Error creating image:", error);
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
      console.log("🎲 Starting 3D model generation:", prompt);

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

      // Record action
      recordAction("3d_model_generated", { prompt, jobId });

      return {
        success: true,
        message: `I'm generating your 3D model now. This will take 15-30 minutes. You can check the progress on the 3D Model page.`,
        data: { jobId },
      };
    } catch (error) {
      console.error("Error creating 3D model:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create 3D model",
      };
    }
  }

  function handleNavigate(args: { page: string }) {
    const { page } = args;

    setTimeout(() => {
      router.push(page as any);
    }, 1000);

    const pageName = page.split("/").pop() || "page";
    return {
      success: true,
      message: `Opening ${pageName} page...`,
    };
  }

  async function handleListFiles() {
    try {
      const response = await fetch(buildServerUrl("/file-library"));
      const data = await response.json();
      const files = data.files || [];

      setTimeout(() => {
        router.push("/files");
      }, 1500);

      return {
        success: true,
        message: `You have ${files.length} files in your library. Opening the files page...`,
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
        message: "Capturing images from all connected cameras...",
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
    const { camera_id, question } = args;

    try {
      console.log("👁️ Analyzing camera view...", args);

      const socket = getSecuritySocket();

      if (!socket) {
        throw new Error("Security socket not available");
      }

      const cameras = await new Promise<CameraPresence[]>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for camera list"));
        }, 5000);

        const handleList = ({ cameras }: { cameras: CameraPresence[] }) => {
          clearTimeout(timeout);
          socket.off("cameras:list", handleList);
          resolve(cameras);
        };

        socket.on("cameras:list", handleList);
        socket.emit("cameras:requestList");
      });

      if (cameras.length === 0) {
        return {
          success: false,
          message:
            "No cameras are currently available. Please ensure a camera is connected on the Security page.",
        };
      }

      const targetCamera = camera_id
        ? cameras.find((c) => c.cameraId === camera_id)
        : cameras[0];

      if (!targetCamera) {
        return {
          success: false,
          message: camera_id
            ? `Camera "${camera_id}" not found.`
            : "No cameras available.",
        };
      }

      console.log("📹 Using camera:", targetCamera.friendlyName);

      socket.emit("security:subscribe", { cameraId: targetCamera.cameraId });

      const frame = await new Promise<SecurityFramePayload>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for camera frame"));
          }, 8000);

          const handleFrame = (payload: SecurityFramePayload) => {
            if (payload.cameraId === targetCamera.cameraId) {
              clearTimeout(timeout);
              socket.off("security:frame", handleFrame);
              resolve(payload);
            }
          };

          socket.on("security:frame", handleFrame);
        },
      );

      console.log("📸 Frame captured from camera");

      socket.emit("security:unsubscribe", { cameraId: targetCamera.cameraId });

      const timestamp = new Date(frame.ts).toLocaleTimeString();
      const imageDataUrl = `data:image/jpeg;base64,${frame.jpegBase64}`;

      // Save the frame to file library
      try {
        const saveResponse = await fetch(
          buildServerUrl("/file-library/store-image"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dataUrl: imageDataUrl,
              filename: `akior-vision-${targetCamera.friendlyName}`,
              prompt: `Camera view from ${targetCamera.friendlyName}`,
            }),
          },
        );

        if (saveResponse.ok) {
          const { filename } = await saveResponse.json();
          console.log("💾 Saved camera frame to files:", filename);
        }
      } catch (saveError) {
        console.warn("⚠️ Error saving camera frame:", saveError);
      }

      return {
        success: true,
        message: `Captured view from ${targetCamera.friendlyName} at ${timestamp}. Analyzing the image...`,
        imageUrl: imageDataUrl,
        data: {
          camera: targetCamera.friendlyName,
          timestamp: frame.ts,
          question: question || "What do you see in this image?",
        },
      };
    } catch (error) {
      console.error("❌ Error analyzing camera view:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to analyze camera view.",
      };
    }
  }

  async function handleRecallMemory(args: {
    query: string;
    time_range?: string;
    content_type?: string;
    limit?: number;
  }) {
    const {
      query,
      time_range = "all_time",
      content_type = "all",
      limit = 10,
    } = args;

    try {
      console.log("🧠 Recalling memories:", query, time_range, content_type);

      // Calculate date range based on time_range parameter
      const now = new Date();
      let startDate: Date | null = null;

      switch (time_range) {
        case "today":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          break;
        case "yesterday":
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1,
          );
          break;
        case "last_week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "last_month":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = null; // all_time
      }

      const results: any[] = [];

      // Search conversations if needed
      if (content_type === "all" || content_type === "conversations") {
        try {
          const convResponse = await fetch(
            buildServerUrl(
              `/api/conversations?search=${encodeURIComponent(query)}&limit=${Math.min(limit, 50)}`,
            ),
          );

          if (convResponse.ok) {
            const convData = await convResponse.json();
            const filteredConvs = startDate
              ? convData.conversations.filter(
                  (c: any) => new Date(c.timestamp) >= startDate,
                )
              : convData.conversations;

            results.push(
              ...filteredConvs.map((c: any) => ({
                type: "conversation",
                id: c.id,
                timestamp: c.timestamp,
                title: c.metadata?.title || "Untitled conversation",
                preview: c.messages?.[0]?.content?.substring(0, 100) || "",
                source: c.source,
              })),
            );
          }
        } catch (error) {
          console.error("Error searching conversations:", error);
        }
      }

      // Search actions if needed
      if (
        content_type === "all" ||
        content_type === "actions" ||
        content_type === "images" ||
        content_type === "3d_models"
      ) {
        try {
          // Filter action types based on content_type
          let actionType = "";
          if (content_type === "images") actionType = "image_generated";
          else if (content_type === "3d_models")
            actionType = "3d_model_generated";

          const actionUrl = actionType
            ? buildServerUrl(
                `/api/actions?type=${actionType}&limit=${Math.min(limit, 50)}`,
              )
            : buildServerUrl(`/api/actions?limit=${Math.min(limit, 50)}`);

          const actionResponse = await fetch(actionUrl);

          if (actionResponse.ok) {
            const actionData = await actionResponse.json();
            const filteredActions = startDate
              ? actionData.actions.filter(
                  (a: any) => new Date(a.timestamp) >= startDate,
                )
              : actionData.actions;

            // Further filter actions by query in metadata
            const matchingActions = filteredActions.filter((a: any) => {
              const metadataStr = JSON.stringify(
                a.metadata || {},
              ).toLowerCase();
              return metadataStr.includes(query.toLowerCase());
            });

            results.push(
              ...matchingActions.map((a: any) => ({
                type: "action",
                actionType: a.type,
                timestamp: a.timestamp,
                metadata: a.metadata,
                source: a.source,
              })),
            );
          }
        } catch (error) {
          console.error("Error searching actions:", error);
        }
      }

      // Sort by timestamp descending and limit results
      results.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      const limitedResults = results.slice(0, limit);

      if (limitedResults.length === 0) {
        return {
          success: true,
          message: `I couldn't find any memories matching "${query}" in the ${time_range.replace("_", " ")} period. Try a different search term or time range.`,
          data: { results: [], query, time_range, content_type },
        };
      }

      // Format results into a readable message
      let message = `I found ${limitedResults.length} matching memor${limitedResults.length === 1 ? "y" : "ies"} for "${query}":\n\n`;

      limitedResults.forEach((result, index) => {
        const date = new Date(result.timestamp).toLocaleDateString();

        if (result.type === "conversation") {
          message += `${index + 1}. 💬 Conversation from ${date} (${result.source})\n   "${result.preview}..."\n\n`;
        } else if (result.type === "action") {
          const actionLabel = result.actionType.replace("_", " ");
          const details =
            result.metadata?.prompt ||
            result.metadata?.messageId ||
            "No details";
          message += `${index + 1}. ⚡ ${actionLabel} on ${date}\n   ${details}\n\n`;
        }
      });

      return {
        success: true,
        message: message.trim(),
        data: { results: limitedResults, query, time_range, content_type },
      };
    } catch (error) {
      console.error("Error recalling memories:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to recall memories",
      };
    }
  }

  // Handle tool calls from the API
  async function handleToolCalls(
    toolCalls: ToolCall[],
    currentResponseId: string,
  ): Promise<any> {
    console.log("🔧 Handling tool calls:", toolCalls);

    // Add function execution messages
    const executionMessages: ChatMessage[] = toolCalls.map((tc) => ({
      id: createId(),
      role: "function" as const,
      content: `Executing ${tc.function.name}...`,
      status: "executing" as const,
      functionName: tc.function.name,
    }));

    setMessages((prev) => [...prev, ...executionMessages]);

    // Execute all functions
    const toolResults = await Promise.all(
      toolCalls.map(async (tc) => {
        try {
          const args = JSON.parse(tc.function.arguments);
          const result = await executeFunction(tc.function.name, args);

          // Update the execution message with result
          setMessages((prev) =>
            prev.map((msg) => {
              if (
                msg.functionName === tc.function.name &&
                msg.status === "executing"
              ) {
                return {
                  ...msg,
                  content: result.message,
                  status: result.success ? undefined : ("error" as const),
                  imageUrl: result.imageUrl,
                };
              }
              return msg;
            }),
          );

          return {
            toolCallId: tc.id,
            output: JSON.stringify(result),
          };
        } catch (error) {
          console.error(`Error executing ${tc.function.name}:`, error);
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error";

          setMessages((prev) =>
            prev.map((msg) => {
              if (
                msg.functionName === tc.function.name &&
                msg.status === "executing"
              ) {
                return {
                  ...msg,
                  content: `Error: ${errorMsg}`,
                  status: "error" as const,
                };
              }
              return msg;
            }),
          );

          return {
            toolCallId: tc.id,
            output: JSON.stringify({ success: false, message: errorMsg }),
          };
        }
      }),
    );

    // Send tool results back to continue the conversation
    return submitToolResults(currentResponseId, toolResults);
  }

  async function submitToolResults(
    currentResponseId: string,
    toolResults: Array<{ toolCallId: string; output: string }>,
  ): Promise<any> {
    const latestSettings = readSettings().textChat;

    // Parse all tool results to extract meaningful messages
    const resultMessages = toolResults
      .map((tr) => {
        try {
          const parsed = JSON.parse(tr.output);
          return parsed.message || JSON.stringify(parsed);
        } catch {
          return tr.output;
        }
      })
      .join("\n");

    try {
      // For simpler compatibility, just send a continuation message asking for acknowledgment
      const response = await fetch(buildServerUrl("/openai/text-chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages
              .filter((m) => m.role !== "function") // Exclude function execution messages
              .map((m) => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.content,
              })),
            {
              role: "user",
              content: `[Function results: ${resultMessages}]\n\nPlease acknowledge or respond naturally based on these function results.`,
            },
          ],
          settings: {
            model: latestSettings?.model,
            initialPrompt: latestSettings?.initialPrompt,
            reasoningEffort: latestSettings?.reasoningEffort,
            verbosity: latestSettings?.verbosity,
            maxOutputTokens: latestSettings?.maxOutputTokens,
          },
          tools: getFunctionTools(),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload?.error || "Failed to get response after function execution.";
        throw new Error(message);
      }

      // Check if there are more tool calls
      if (payload?.toolCalls && payload.toolCalls.length > 0) {
        console.log("🔄 More tool calls to execute...");
        setResponseId(payload.responseId || null);
        return handleToolCalls(payload.toolCalls, payload.responseId);
      }

      // Otherwise, we got the final response
      if (payload?.message) {
        const assistantMessage: ChatMessage = {
          id: createId(),
          role: "assistant",
          content: payload.message.trim(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setResponseId(payload.responseId || null);
      }
    } catch (error) {
      console.error("Error after function execution:", error);
      const errorMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content:
          error instanceof Error
            ? error.message
            : "Failed to continue conversation after function execution.",
        status: "error",
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  }

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    const latestSettings = readSettings();
    const textChatSettings = latestSettings.textChat;
    const webSearchConfig = latestSettings.integrations?.webSearch;
    setChatSettings(textChatSettings);

    let userContent = trimmed;

    // If web search is enabled and configured, augment message with search results
    if (
      textChatSettings?.useWebSearch &&
      isIntegrationConnected("webSearch", webSearchConfig)
    ) {
      try {
        console.log("[Chat] Web search enabled, querying...");
        const searchResponse = await fetch(
          buildServerUrl("/api/integrations/web-search"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: trimmed, maxResults: 3 }),
          },
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (
            searchData.ok &&
            searchData.results &&
            searchData.results.length > 0
          ) {
            const resultsText = searchData.results
              .map(
                (r: any, idx: number) =>
                  `${idx + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`,
              )
              .join("\n\n");
            userContent = `${trimmed}\n\n[Relevant web search results:]\n${resultsText}`;
            console.log(
              "[Chat] Augmented message with",
              searchData.results.length,
              "search results",
            );
          }
        } else {
          console.warn(
            "[Chat] Web search request failed:",
            searchResponse.status,
          );
        }
      } catch (err) {
        console.error("[Chat] Web search error:", err);
        // Continue without search results
      }
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: trimmed,
    };
    const pendingId = createId();
    const conversation = [...messages, userMessage];

    setMessages([
      ...conversation,
      { id: pendingId, role: "assistant", content: "", status: "pending" },
    ]);
    setInput("");
    setError(null);
    setIsSending(true);

    // Record user message as action
    recordAction("message_sent", {
      messageId: userMessage.id,
      contentLength: trimmed.length,
      source: "text-chat",
    });

    try {
      const response = await fetch(buildServerUrl("/openai/text-chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.map((msg, idx) => ({
            role: msg.role,
            content:
              idx === conversation.length - 1 ? userContent : msg.content,
          })),
          previousResponseId: responseId ?? undefined,
          settings: {
            model: textChatSettings?.model,
            initialPrompt: textChatSettings?.initialPrompt,
            reasoningEffort: textChatSettings?.reasoningEffort,
            verbosity: textChatSettings?.verbosity,
            maxOutputTokens: textChatSettings?.maxOutputTokens,
          },
          tools: getFunctionTools(),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload?.error || "Unable to get a response from GPT-5.";
        throw new Error(message);
      }

      // Remove pending message
      setMessages((prev) => prev.filter((m) => m.id !== pendingId));

      // Check if response contains tool calls
      if (payload?.toolCalls && payload.toolCalls.length > 0) {
        console.log("🔧 Tool calls received:", payload.toolCalls);
        setResponseId(payload.responseId || null);
        await handleToolCalls(payload.toolCalls, payload.responseId);
      } else {
        // Regular text response
        const assistantContent =
          typeof payload?.message === "string" ? payload.message.trim() : "";
        const nextResponseId = payload?.responseId
          ? String(payload.responseId)
          : null;

        setResponseId(nextResponseId);
        const assistantMessage: ChatMessage = {
          id: createId(),
          role: "assistant",
          content:
            assistantContent ||
            "I had trouble generating a response this time.",
          status: assistantContent ? undefined : "error",
          source: payload?.source ?? null,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send message.";
      setError(message);
      setMessages((prev) =>
        prev.map((entry) =>
          entry.id === pendingId
            ? ({
                id: pendingId,
                role: "assistant",
                content: message,
                status: "error",
              } satisfies ChatMessage)
            : entry,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, messages, responseId]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void sendMessage();
    },
    [sendMessage],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage],
  );

  // Save conversation to backend
  const saveConversation = useCallback(async () => {
    if (messages.length === 0) return;

    try {
      // Filter out pending and function messages for cleaner storage
      const messagesToSave = messages
        .filter((m) => m.status !== "pending" && m.role !== "function")
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      if (messagesToSave.length === 0) return;

      // Generate a title from the first user message
      const firstUserMessage = messagesToSave.find((m) => m.role === "user");
      const title = firstUserMessage
        ? firstUserMessage.content.substring(0, 50) +
          (firstUserMessage.content.length > 50 ? "..." : "")
        : "Chat conversation";

      const response = await fetch(buildServerUrl("/api/conversations/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "chat",
          messages: messagesToSave,
          metadata: {
            title,
            model: chatSettings?.model || "gpt-5",
            messageCount: messagesToSave.length,
          },
          tags: ["text-chat"],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConversationId(data.id);
        console.log("💾 Conversation saved:", data.id);
      } else {
        console.warn("⚠️ Failed to save conversation:", response.statusText);
      }
    } catch (error) {
      console.error("❌ Error saving conversation:", error);
    }
  }, [messages, chatSettings]);

  const clearConversation = useCallback(async () => {
    // Save conversation before clearing
    await saveConversation();

    setMessages([]);
    setResponseId(null);
    setError(null);
    setConversationId(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingMessageId(null);
  }, [saveConversation]);

  // Determine active TTS provider and endpoint
  const getActiveTtsProvider = useCallback((): {
    endpoint: string;
    name: string;
  } | null => {
    const settings = readSettings();
    const ttsProvider = settings.textChat?.ttsProvider || "elevenlabs";

    // Check provider based on setting
    if (
      ttsProvider === "azure" &&
      isIntegrationConnected("azureTTS", settings.integrations?.azureTTS)
    ) {
      return { endpoint: "/integrations/azure-tts/tts", name: "Azure TTS" };
    } else if (
      ttsProvider === "elevenlabs" &&
      isIntegrationConnected("elevenLabs", settings.integrations?.elevenLabs)
    ) {
      return { endpoint: "/integrations/elevenlabs/tts", name: "ElevenLabs" };
    }

    // No provider available
    return null;
  }, []);

  const speakMessage = useCallback(
    async (messageId: string, text: string) => {
      const ttsProvider = getActiveTtsProvider();

      if (!ttsProvider) {
        setError(
          "TTS provider is not configured. Please enable and configure a provider in Settings.",
        );
        return;
      }

      try {
        setSpeakingMessageId(messageId);

        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        const response = await fetch(buildServerUrl(ttsProvider.endpoint), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "TTS request failed" }));
          throw new Error(errorData.error || `TTS failed: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setSpeakingMessageId(null);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          setSpeakingMessageId(null);
          setError("Failed to play audio.");
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
      } catch (err) {
        console.error("Error speaking message:", err);
        setSpeakingMessageId(null);
        setError(
          err instanceof Error ? err.message : "Failed to speak message.",
        );
      }
    },
    [getActiveTtsProvider],
  );

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingMessageId(null);
  }, []);

  const disableSend = isSending || !input.trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Text Chat with Function Calling
          </h1>
          <p className="text-sm text-white/60">
            Using {activeModel} • reasoning: {activeReasoning} • verbosity:{" "}
            {activeVerbosity}
          </p>
          <div className="flex flex-wrap gap-2 items-center mt-1">
            <p className="text-xs jarvis-accent-text">
              ✨ Function calling enabled - I can create images, generate 3D
              models, navigate pages, and more!
            </p>
            {chatSettings?.useWebSearch && (
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  isIntegrationConnected(
                    "webSearch",
                    readSettings().integrations?.webSearch,
                  )
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/20 text-amber-400"
                }`}
              >
                {isIntegrationConnected(
                  "webSearch",
                  readSettings().integrations?.webSearch,
                )
                  ? "🌐 Web search: ON"
                  : "🌐 Web search: ON (not configured)"}
              </span>
            )}
          </div>
        </div>
        {messages.length ? (
          <button
            className="btn border-white/15 bg-transparent text-white/70 hover:bg-white/10"
            type="button"
            onClick={clearConversation}
            disabled={isSending}
          >
            Clear conversation
          </button>
        ) : null}
      </div>

      <div className="card flex h-[70vh] flex-col overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-white/50">
              <div className="space-y-4 max-w-xl">
                <p>
                  Start a conversation with AKIOR's GPT-5 text assistant with
                  function calling.
                </p>
                <div className="text-xs text-left space-y-2 p-4 bg-white/5 rounded-xl">
                  <p className="jarvis-accent-text font-semibold">
                    Try asking me to:
                  </p>
                  <ul className="space-y-1 text-white/70">
                    <li>• Create an image of a futuristic city</li>
                    <li>• Generate a 3D model of a hammer</li>
                    <li>• Show me my files</li>
                    <li>• Navigate to the settings page</li>
                    <li>• Capture images from the cameras</li>
                    <li>• What do you see? (with camera connected)</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user";
              const isFunction = message.role === "function";

              let bubbleClass = "";
              if (isUser) {
                bubbleClass =
                  "bg-[color:rgb(var(--jarvis-accent)_/_0.8)] text-white border border-[color:rgb(var(--jarvis-accent)_/_0.4)]";
              } else if (isFunction) {
                if (message.status === "executing") {
                  bubbleClass =
                    "bg-[color:rgb(var(--jarvis-accent)_/_0.2)] jarvis-accent-text border border-[color:rgb(var(--jarvis-accent)_/_0.4)] animate-pulse";
                } else if (message.status === "error") {
                  bubbleClass =
                    "bg-rose-500/10 text-rose-100 border border-rose-500/40";
                } else {
                  bubbleClass =
                    "bg-[color:rgb(var(--jarvis-accent)_/_0.1)] jarvis-accent-text border border-[color:rgb(var(--jarvis-accent)_/_0.3)]";
                }
              } else {
                if (message.status === "error") {
                  bubbleClass =
                    "bg-rose-500/10 text-rose-100 border border-rose-500/40";
                } else {
                  bubbleClass =
                    "bg-white/5 text-white/90 border border-white/10 backdrop-blur-sm";
                }
              }

              return (
                <div
                  key={message.id}
                  className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex max-w-[75%] flex-col gap-1 ${
                      isUser ? "items-end text-right" : "items-start text-left"
                    }`}
                  >
                    <span
                      className={`text-xs uppercase tracking-wide ${
                        isUser
                          ? "jarvis-accent-text opacity-80"
                          : isFunction
                            ? "jarvis-accent-text"
                            : "text-white/50"
                      }`}
                    >
                      {isUser ? "You" : isFunction ? "⚙️ Function" : "AKIOR"}
                    </span>
                    <div
                      className={`whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-lg ${bubbleClass}`}
                    >
                      {message.status === "pending" ? (
                        <span className="flex items-center gap-2 text-white/70">
                          <span className="h-2 w-2 animate-ping rounded-full bg-white/70" />
                          Thinking…
                        </span>
                      ) : (
                        <>
                          {message.content}
                          {message.imageUrl && (
                            <div className="mt-3">
                              <img
                                src={message.imageUrl}
                                alt="Generated content"
                                className="max-w-full rounded-lg border border-[color:rgb(var(--jarvis-accent)_/_0.3)]"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {/* Speak button for assistant messages */}
                    {!isUser &&
                      !isFunction &&
                      message.content &&
                      message.status !== "pending" &&
                      message.status !== "error" &&
                      getActiveTtsProvider() && (
                        <button
                          onClick={() => {
                            if (speakingMessageId === message.id) {
                              stopSpeaking();
                            } else {
                              void speakMessage(message.id, message.content);
                            }
                          }}
                          disabled={
                            speakingMessageId !== null &&
                            speakingMessageId !== message.id
                          }
                          className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                            speakingMessageId === message.id
                              ? "bg-[color:rgb(var(--jarvis-accent)_/_0.2)] jarvis-accent-text"
                              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {speakingMessageId === message.id
                            ? "⏹ Stop"
                            : "🔊 Speak answer"}
                        </button>
                      )}
                    {message.status === "error" ? (
                      <span className="text-xs text-rose-200">
                        An error occurred.
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <form
          className="space-y-3 border-t border-white/5 bg-black/20 px-6 py-4 backdrop-blur"
          onSubmit={handleSubmit}
        >
          {error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </div>
          ) : null}
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="sr-only" htmlFor="chat-input">
                Message
              </label>
              <textarea
                id="chat-input"
                rows={3}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me to create images, generate 3D models, or anything else… (Shift + Enter for a new line)"
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-[color:rgb(var(--jarvis-accent))] focus:outline-none focus:ring-1 focus:ring-[color:rgb(var(--jarvis-accent)_/_0.4)]"
                disabled={isSending}
              />
            </div>
            <div className="flex gap-2 md:w-auto">
              <button
                className="btn flex items-center gap-2 border-[color:rgb(var(--jarvis-accent)_/_0.4)] bg-[color:rgb(var(--jarvis-accent)_/_0.8)] px-5 py-2 text-sm font-medium text-white hover:bg-[color:rgb(var(--jarvis-accent))]"
                type="submit"
                disabled={disableSend}
              >
                {isSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
