import { buildServerUrl } from "./api";
import { getCameraSocket } from "./socket";
import { handleCameraAnalysis } from "./camera-handler";
import { readSettings } from "@shared/settings";
import { isFunctionEnabledSync } from "@/hooks/useFunctionSettings";

interface ExecutionContext {
  setDisplayContent?: (
    content: { type: "image" | "3d"; url: string } | null,
  ) => void;
  setModelProgress?: (progress: number | null) => void;
  setProgressMessage?: (message: string) => void;
  dataChannel?: RTCDataChannel | null;
  router?: any;
}

/**
 * Central function executor - ALL AKIOR function implementations in ONE place
 * This is used by both the full-screen AKIOR page and the mini assistant
 */
export async function executeJarvisFunction(
  name: string,
  args: any,
  context: ExecutionContext,
): Promise<any> {
  console.log(`🎯 Executing function: ${name}`, args);

  // Check if function is enabled
  if (!isFunctionEnabledSync(name)) {
    console.warn(`⚠️ Function ${name} is disabled`);
    return {
      success: false,
      message: `The function "${name}" is currently disabled. You can enable it from the Functions page.`,
    };
  }

  switch (name) {
    case "create_image":
      return await handleCreateImage(args, context);

    case "create_3d_model":
      return await handleCreate3DModel(args, context);

    case "navigate_to_page":
      return handleNavigate(args, context);

    case "list_files":
      return await handleListFiles();

    case "search_files":
      return await handleSearchFiles(args);

    case "open_file":
      return await handleOpenFile(args, context);

    case "capture_images":
      return await handleCaptureImages(args);

    case "analyze_camera_view":
      return await handleAnalyzeCameraView(args, context);

    case "open_holomat_app":
      return await handleOpenHolomatApp(args);

    case "open_model_on_holomat":
      return await handleOpenModelOnHolomat(args);

    case "compose_email":
      return await handleComposeEmail(args);

    case "check_email":
      return await handleCheckEmail(args);

    // Agent D: Weather, Notes, Reminders, Alarms
    case "get_weather":
      return await handleGetWeather(args);

    case "create_note":
      return await handleCreateNote(args);

    case "list_notes":
      return await handleListNotes();

    case "delete_note":
      return await handleDeleteNote(args);

    case "set_reminder":
      return await handleSetReminder(args);

    case "list_reminders":
      return await handleListReminders();

    case "cancel_reminder":
      return await handleCancelReminder(args);

    case "set_alarm":
      return await handleSetAlarm(args);

    case "list_alarms":
      return await handleListAlarms();

    case "toggle_alarm":
      return await handleToggleAlarm(args);

    case "delete_alarm":
      return await handleDeleteAlarm(args);

    default:
      return { success: false, message: `Unknown function: ${name}` };
  }
}

// ============================================================================
// FUNCTION IMPLEMENTATIONS
// ============================================================================

async function handleCreateImage(
  args: { prompt: string; size?: string },
  context: ExecutionContext,
) {
  const { prompt, size = "1024x1024" } = args;

  try {
    console.log("🎨 Starting image generation:", prompt);

    const settings = readSettings();
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
        settings: { ...imageSettings, size },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Failed to generate image: ${response.statusText}`,
      );
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error("No response body");

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
          if (parsed.type === "final_image" && parsed.image) {
            imageUrl = `data:image/png;base64,${parsed.image}`;
          } else if (parsed.type === "error") {
            throw new Error(
              parsed.error || parsed.message || "Image generation failed",
            );
          }
        } catch (e) {
          if (
            e instanceof Error &&
            (e.message.includes("generation failed") ||
              e.message.includes("OpenAI"))
          ) {
            throw e;
          }
        }
      }
    }

    if (imageUrl) {
      context.setDisplayContent?.({ type: "image", url: imageUrl });
      return { success: true, message: "Here is your image, Sir." };
    } else {
      throw new Error("No image generated");
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

async function handleCreate3DModel(
  args: { prompt: string },
  context: ExecutionContext,
) {
  const { prompt } = args;

  try {
    console.log("🎲 Starting 3D model generation...");
    context.setProgressMessage?.("Generating 3D Model");
    context.setModelProgress?.(0);

    const createResponse = await fetch(buildServerUrl("/models/create"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "text",
        prompt,
        settings: { artStyle: "realistic", outputFormat: "glb" },
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to create 3D model job");
    }

    const { id: jobId } = await createResponse.json();
    console.log("🎲 Job created:", jobId);

    let attempts = 0;
    const maxAttempts = 1800;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusResponse = await fetch(buildServerUrl(`/models/${jobId}`));
      if (!statusResponse.ok) throw new Error("Failed to check model status");

      const job = await statusResponse.json();

      if (typeof job.progress === "number") {
        context.setModelProgress?.(job.progress);
      }

      if (job.status === "done") {
        const modelUrl =
          job.outputs?.glbUrl || job.outputs?.objUrl || job.outputs?.usdzUrl;
        if (modelUrl) {
          context.setModelProgress?.(null);
          context.setDisplayContent?.({ type: "3d", url: modelUrl });
          return {
            success: true,
            message: "3D model created successfully, Sir.",
          };
        } else {
          throw new Error("Model completed but no URL in outputs");
        }
      } else if (job.status === "error") {
        throw new Error(job.error || "Model generation failed");
      }

      attempts++;
    }

    throw new Error("Model generation timed out");
  } catch (error) {
    console.error("Error creating 3D model:", error);
    context.setModelProgress?.(null);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create 3D model",
    };
  }
}

function handleNavigate(args: { page: string }, context: ExecutionContext) {
  const { page } = args;

  if (typeof window !== "undefined") {
    window.location.href = page;
  }

  const pageName = page.split("/").pop() || "page";
  return { success: true, message: `Opening ${pageName}...` };
}

async function handleListFiles() {
  try {
    const response = await fetch(buildServerUrl("/file-library"));
    if (!response.ok) throw new Error("Failed to fetch files");

    const data = await response.json();
    const files = Array.isArray(data.files) ? data.files : [];

    if (files.length === 0) {
      return { success: false, message: "No files available in the library." };
    }

    return {
      success: true,
      message: `Found ${files.length} file${files.length === 1 ? "" : "s"} in the library.`,
      data: { files },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to list files: ${error.message}`,
    };
  }
}

async function handleSearchFiles(args: { query?: string }) {
  try {
    const response = await fetch(buildServerUrl("/file-library"));
    if (!response.ok) throw new Error("Failed to fetch files");

    const data = await response.json();
    const files = Array.isArray(data.files) ? data.files : [];

    const query = args.query?.toLowerCase() || "";
    const matchingFiles = query
      ? files.filter((f: any) => f.name.toLowerCase().includes(query))
      : files;

    if (matchingFiles.length === 0) {
      return {
        success: false,
        message: query
          ? `No files found matching "${query}".`
          : "No files available in the library.",
      };
    }

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

async function handleOpenFile(
  args: { filename: string; file_type: "image" | "model" | "other" },
  context: ExecutionContext,
) {
  const { filename, file_type } = args;

  try {
    console.log(`📂 Opening file: ${filename} (type: ${file_type})`);

    if (file_type === "model") {
      context.setProgressMessage?.("Loading 3D Model");
    } else if (file_type === "image") {
      context.setProgressMessage?.("Loading Image");
    }

    context.setModelProgress?.(0);
    for (let i = 0; i <= 100; i += 20) {
      context.setModelProgress?.(i);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    context.setModelProgress?.(null);

    const fileUrl = buildServerUrl(`/files/${filename}`);

    if (file_type === "image") {
      context.setDisplayContent?.({ type: "image", url: fileUrl });
      return { success: true, message: `Opening ${filename}` };
    } else if (file_type === "model") {
      context.setDisplayContent?.({ type: "3d", url: fileUrl });
      return { success: true, message: `Rendering ${filename}` };
    } else {
      if (typeof window !== "undefined") {
        window.open(fileUrl, "_blank");
      }
      return { success: true, message: `Opening ${filename} in new tab` };
    }
  } catch (error: any) {
    context.setModelProgress?.(null);
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

    return { success: true, message: "Capturing images from all cameras..." };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to capture images: ${error.message}`,
    };
  }
}

async function handleAnalyzeCameraView(
  args: { camera_id?: string | null; question?: string | null },
  context: ExecutionContext,
) {
  return await handleCameraAnalysis(
    args,
    context.dataChannel ?? null,
    (imageUrl, caption) => {
      context.setDisplayContent?.({ type: "image", url: imageUrl });
    },
  );
}

async function handleOpenHolomatApp(args: { app_name: string }) {
  try {
    const socket = getCameraSocket();

    if (!socket) {
      throw new Error("Socket connection not available");
    }

    console.log("🚀 Opening holomat app:", args.app_name);

    socket.emit("holomat:openApp", { appName: args.app_name });

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      message: `Opening ${args.app_name} on the Holomat...`,
    };
  } catch (error: any) {
    console.error("Error in handleOpenHolomatApp:", error);
    return {
      success: false,
      message: `Failed to open holomat app: ${error.message}`,
    };
  }
}

async function handleOpenModelOnHolomat(args: { filename: string }) {
  try {
    const socket = getCameraSocket();

    if (!socket) {
      throw new Error("Socket connection not available");
    }

    console.log("🎨 Opening model on holomat:", args.filename);

    // Construct the model URL from the filename
    const modelUrl = buildServerUrl(`/files/${args.filename}`);
    const modelName = args.filename;

    socket.emit("holomat:openModel", { modelUrl, modelName });

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      message: `Opening ${args.filename} on the Holomat 3D viewer...`,
    };
  } catch (error: any) {
    console.error("Error in handleOpenModelOnHolomat:", error);
    return {
      success: false,
      message: `Failed to open model: ${error.message}`,
    };
  }
}

async function handleComposeEmail(args: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}) {
  try {
    console.log("📧 Composing email to:", args.to);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.to)) {
      return {
        success: false,
        message: `Invalid email address: ${args.to}`,
      };
    }

    // Send email via backend API
    const response = await fetch(buildServerUrl("/integrations/gmail/send"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: args.to,
        subject: args.subject,
        body: args.body,
        cc: args.cc,
        bcc: args.bcc,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));

      // Handle specific error cases
      if (errorData.error === "gmail_not_configured") {
        return {
          success: false,
          message:
            "Gmail is not configured. Please set up your Gmail integration in Settings.",
        };
      }

      throw new Error(errorData.error || "Failed to send email");
    }

    const result = await response.json();

    if (result.ok) {
      return {
        success: true,
        message: `Email sent successfully to ${args.to}, Sir.`,
        data: { messageId: result.messageId },
      };
    } else {
      throw new Error(result.error || "Failed to send email");
    }
  } catch (error: any) {
    console.error("❌ Error sending email:", error);
    return {
      success: false,
      message: `Failed to send email: ${error.message}`,
    };
  }
}

async function handleCheckEmail(args: { count?: number }) {
  try {
    const count = Math.min(args.count || 5, 20); // Max 20 emails
    console.log(`📬 Checking ${count} recent emails...`);

    // Fetch inbox from backend API
    const response = await fetch(
      buildServerUrl(`/integrations/gmail/inbox?maxResults=${count}`),
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));

      if (errorData.error === "gmail_not_configured") {
        return {
          success: false,
          message:
            "Gmail is not configured. Please set up your Gmail integration in Settings.",
        };
      }

      throw new Error(errorData.error || "Failed to fetch emails");
    }

    const result = await response.json();

    if (!result.ok || !result.messages) {
      throw new Error("Failed to retrieve emails");
    }

    const messages = result.messages;

    if (messages.length === 0) {
      return {
        success: true,
        message: "You have no new emails, Sir.",
        data: { messages: [] },
      };
    }

    // Format email summaries
    const emailSummaries = messages
      .slice(0, 5)
      .map((msg: any) => {
        const from = msg.from || "Unknown sender";
        const subject = msg.subject || "(No subject)";
        const date = msg.date
          ? new Date(msg.date).toLocaleDateString()
          : "Unknown date";
        return `From ${from}: "${subject}" (${date})`;
      })
      .join("; ");

    const totalCount = messages.length;
    const displayMessage =
      totalCount === 1
        ? `You have 1 email, Sir. ${emailSummaries}`
        : `You have ${totalCount} emails, Sir. Most recent: ${emailSummaries}`;

    return {
      success: true,
      message: displayMessage,
      data: { messages, count: totalCount },
    };
  } catch (error: any) {
    console.error("❌ Error checking email:", error);
    return {
      success: false,
      message: `Failed to check email: ${error.message}`,
    };
  }
}

// ============================================================================
// AGENT D: Weather, Notes, Reminders, Alarms
// ============================================================================

async function handleGetWeather(args: { location?: string }) {
  try {
    console.log(
      "🌤️ Fetching weather for:",
      args.location || "default location",
    );

    const response = await fetch(
      buildServerUrl("/api/integrations/weather/query"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: args.location }),
      },
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));

      if (errorData.error === "weather_api_key_not_configured") {
        return {
          success: false,
          message:
            "Weather API is not configured. Please set up your OpenWeather API key.",
        };
      }

      throw new Error(errorData.error || "Failed to fetch weather");
    }

    const result = await response.json();
    const weather = result.data;

    const message = `The weather in ${weather.location} is currently ${weather.temperatureC}°C (${weather.temperatureF}°F) and ${weather.condition.toLowerCase()}. Humidity is ${weather.humidity}% with winds at ${weather.windKph} km/h.`;

    return {
      success: true,
      message,
      data: weather,
    };
  } catch (error: any) {
    console.error("❌ Error fetching weather:", error);
    return {
      success: false,
      message: `Failed to get weather: ${error.message}`,
    };
  }
}

async function handleCreateNote(args: { content: string; tags?: string[] }) {
  try {
    console.log("📝 Creating note:", args.content.substring(0, 50));

    const response = await fetch(buildServerUrl("/api/notes"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: args.content,
        tags: args.tags,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || "Failed to create note");
    }

    const result = await response.json();

    return {
      success: true,
      message: `I've taken a note: "${args.content.substring(0, 50)}${args.content.length > 50 ? "..." : ""}"`,
      data: result.note,
    };
  } catch (error: any) {
    console.error("❌ Error creating note:", error);
    return {
      success: false,
      message: `Failed to create note: ${error.message}`,
    };
  }
}

async function handleListNotes() {
  try {
    console.log("📝 Fetching all notes...");

    const response = await fetch(buildServerUrl("/api/notes"));

    if (!response.ok) {
      throw new Error("Failed to fetch notes");
    }

    const result = await response.json();
    const notes = result.notes || [];

    if (notes.length === 0) {
      return {
        success: true,
        message: "You have no notes, Sir.",
        data: { notes: [] },
      };
    }

    // Format note summaries
    const noteSummaries = notes
      .slice(0, 5)
      .map((note: any, idx: number) => {
        const preview = note.content.substring(0, 30);
        return `${idx + 1}. "${preview}${note.content.length > 30 ? "..." : ""}"`;
      })
      .join("; ");

    const totalCount = notes.length;
    const displayMessage =
      totalCount === 1
        ? `You have 1 note: ${noteSummaries}`
        : totalCount <= 5
          ? `You have ${totalCount} notes: ${noteSummaries}`
          : `You have ${totalCount} notes. Most recent: ${noteSummaries}`;

    return {
      success: true,
      message: displayMessage,
      data: { notes, count: totalCount },
    };
  } catch (error: any) {
    console.error("❌ Error fetching notes:", error);
    return {
      success: false,
      message: `Failed to fetch notes: ${error.message}`,
    };
  }
}

async function handleDeleteNote(args: { note_id: string }) {
  try {
    const noteId = args.note_id;
    console.log("📝 Deleting note:", noteId);

    const response = await fetch(buildServerUrl(`/api/notes/${noteId}`), {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));

      if (
        errorData.error === "note_not_found" ||
        errorData.error === "no_notes_found"
      ) {
        return {
          success: false,
          message:
            noteId === "last"
              ? "You have no notes to delete."
              : "Note not found.",
        };
      }

      throw new Error(errorData.error || "Failed to delete note");
    }

    return {
      success: true,
      message:
        noteId === "last"
          ? "I've deleted your most recent note."
          : "Note deleted successfully.",
    };
  } catch (error: any) {
    console.error("❌ Error deleting note:", error);
    return {
      success: false,
      message: `Failed to delete note: ${error.message}`,
    };
  }
}

async function handleSetReminder(args: {
  message: string;
  time_expression: string;
}) {
  try {
    console.log(
      "⏰ Setting reminder:",
      args.message,
      "at",
      args.time_expression,
    );

    // Parse time expression using time parser
    const { parseTime, formatTimestamp } = await import("./time-parser");

    let parsedTime;
    try {
      parsedTime = parseTime(args.time_expression);
    } catch (parseError: any) {
      return {
        success: false,
        message: `I couldn't understand the time "${args.time_expression}". Please try formats like "in 30 minutes", "at 6 PM", or "tomorrow at 9 AM".`,
      };
    }

    // Create reminder
    const response = await fetch(buildServerUrl("/api/reminders"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: args.message,
        triggerAt: parsedTime.timestamp,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || "Failed to set reminder");
    }

    const result = await response.json();
    const displayTime = formatTimestamp(parsedTime.timestamp);

    return {
      success: true,
      message: `I've set a reminder for ${displayTime}: ${args.message}`,
      data: result.reminder,
    };
  } catch (error: any) {
    console.error("❌ Error setting reminder:", error);
    return {
      success: false,
      message: `Failed to set reminder: ${error.message}`,
    };
  }
}

async function handleListReminders() {
  try {
    console.log("⏰ Fetching all reminders...");

    const response = await fetch(buildServerUrl("/api/reminders"));

    if (!response.ok) {
      throw new Error("Failed to fetch reminders");
    }

    const result = await response.json();
    const reminders = result.reminders || [];

    // Filter out fired reminders and sort by triggerAt
    const activeReminders = reminders
      .filter((r: any) => !r.fired)
      .sort(
        (a: any, b: any) =>
          new Date(a.triggerAt).getTime() - new Date(b.triggerAt).getTime(),
      );

    if (activeReminders.length === 0) {
      return {
        success: true,
        message: "You have no active reminders, Sir.",
        data: { reminders: [] },
      };
    }

    // Format reminder summaries
    const { formatTimestamp } = await import("./time-parser");
    const reminderSummaries = activeReminders
      .slice(0, 5)
      .map((reminder: any, idx: number) => {
        const time = formatTimestamp(reminder.triggerAt);
        return `${idx + 1}. "${reminder.message}" (${time})`;
      })
      .join("; ");

    const totalCount = activeReminders.length;
    const displayMessage =
      totalCount === 1
        ? `You have 1 reminder: ${reminderSummaries}`
        : totalCount <= 5
          ? `You have ${totalCount} reminders: ${reminderSummaries}`
          : `You have ${totalCount} reminders. Next up: ${reminderSummaries}`;

    return {
      success: true,
      message: displayMessage,
      data: { reminders: activeReminders, count: totalCount },
    };
  } catch (error: any) {
    console.error("❌ Error fetching reminders:", error);
    return {
      success: false,
      message: `Failed to fetch reminders: ${error.message}`,
    };
  }
}

async function handleCancelReminder(args: { reminder_id: string }) {
  try {
    console.log("⏰ Cancelling reminder:", args.reminder_id);

    const response = await fetch(
      buildServerUrl(`/api/reminders/${args.reminder_id}`),
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));

      if (errorData.error === "reminder_not_found") {
        return {
          success: false,
          message: "Reminder not found.",
        };
      }

      throw new Error(errorData.error || "Failed to cancel reminder");
    }

    return {
      success: true,
      message: "Reminder cancelled successfully.",
    };
  } catch (error: any) {
    console.error("❌ Error cancelling reminder:", error);
    return {
      success: false,
      message: `Failed to cancel reminder: ${error.message}`,
    };
  }
}

async function handleSetAlarm(args: {
  name: string;
  type: "time" | "motion";
  time_expression?: string;
  location?: string;
}) {
  try {
    console.log("⏰ Setting alarm:", args.name, "type:", args.type);

    let triggerTime;

    // Parse time for time-based alarms
    if (args.type === "time") {
      if (!args.time_expression) {
        return {
          success: false,
          message: "Please specify when you want the alarm to trigger.",
        };
      }

      const { parseTime } = await import("./time-parser");
      try {
        const parsedTime = parseTime(args.time_expression);
        triggerTime = parsedTime.timestamp;
      } catch (parseError: any) {
        return {
          success: false,
          message: `I couldn't understand the time "${args.time_expression}". Please try formats like "7 AM" or "tomorrow at 6:30".`,
        };
      }
    } else if (args.type === "motion") {
      if (!args.location) {
        return {
          success: false,
          message:
            'Please specify a location for the motion alarm (e.g., "backyard", "front door").',
        };
      }
    }

    // Create alarm
    const response = await fetch(buildServerUrl("/api/alarms"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: args.name,
        type: args.type,
        triggerTime,
        location: args.location,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || "Failed to set alarm");
    }

    const result = await response.json();

    let message;
    if (args.type === "time") {
      const { formatTimestamp } = await import("./time-parser");
      const displayTime = formatTimestamp(triggerTime!);
      message = `I've set an alarm for ${displayTime}: ${args.name}`;
    } else {
      message = `I've set a motion alarm for ${args.location}: ${args.name}`;
    }

    return {
      success: true,
      message,
      data: result.alarm,
    };
  } catch (error: any) {
    console.error("❌ Error setting alarm:", error);
    return {
      success: false,
      message: `Failed to set alarm: ${error.message}`,
    };
  }
}

async function handleListAlarms() {
  try {
    console.log("⏰ Fetching all alarms...");

    const response = await fetch(buildServerUrl("/api/alarms"));

    if (!response.ok) {
      throw new Error("Failed to fetch alarms");
    }

    const result = await response.json();
    const alarms = result.alarms || [];

    if (alarms.length === 0) {
      return {
        success: true,
        message: "You have no alarms, Sir.",
        data: { alarms: [] },
      };
    }

    // Format alarm summaries
    const alarmSummaries = alarms
      .slice(0, 5)
      .map((alarm: any, idx: number) => {
        const status = alarm.enabled ? "enabled" : "disabled";
        const typeInfo =
          alarm.type === "time"
            ? "time-based"
            : alarm.type === "motion"
              ? `motion (${alarm.location})`
              : alarm.type;
        return `${idx + 1}. "${alarm.name}" (${typeInfo}, ${status})`;
      })
      .join("; ");

    const totalCount = alarms.length;
    const enabledCount = alarms.filter((a: any) => a.enabled).length;

    const displayMessage =
      totalCount === 1
        ? `You have 1 alarm: ${alarmSummaries}`
        : `You have ${totalCount} alarms (${enabledCount} enabled): ${alarmSummaries}`;

    return {
      success: true,
      message: displayMessage,
      data: { alarms, count: totalCount, enabledCount },
    };
  } catch (error: any) {
    console.error("❌ Error fetching alarms:", error);
    return {
      success: false,
      message: `Failed to fetch alarms: ${error.message}`,
    };
  }
}

async function handleToggleAlarm(args: { alarm_id: string }) {
  try {
    console.log("⏰ Toggling alarm:", args.alarm_id);

    const response = await fetch(
      buildServerUrl(`/api/alarms/${args.alarm_id}/toggle`),
      {
        method: "PUT",
      },
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));

      if (errorData.error === "alarm_not_found") {
        return {
          success: false,
          message: "Alarm not found.",
        };
      }

      throw new Error(errorData.error || "Failed to toggle alarm");
    }

    const result = await response.json();
    const alarm = result.alarm;

    return {
      success: true,
      message: `Alarm "${alarm.name}" is now ${alarm.enabled ? "enabled" : "disabled"}.`,
      data: alarm,
    };
  } catch (error: any) {
    console.error("❌ Error toggling alarm:", error);
    return {
      success: false,
      message: `Failed to toggle alarm: ${error.message}`,
    };
  }
}

async function handleDeleteAlarm(args: { alarm_id: string }) {
  try {
    console.log("⏰ Deleting alarm:", args.alarm_id);

    const response = await fetch(
      buildServerUrl(`/api/alarms/${args.alarm_id}`),
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));

      if (errorData.error === "alarm_not_found") {
        return {
          success: false,
          message: "Alarm not found.",
        };
      }

      throw new Error(errorData.error || "Failed to delete alarm");
    }

    return {
      success: true,
      message: "Alarm deleted successfully.",
    };
  } catch (error: any) {
    console.error("❌ Error deleting alarm:", error);
    return {
      success: false,
      message: `Failed to delete alarm: ${error.message}`,
    };
  }
}
