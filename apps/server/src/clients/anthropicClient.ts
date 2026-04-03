/**
 * Anthropic Claude Client
 *
 * Client for Anthropic's Messages API.
 * Maps the internal chat interface to Anthropic's format.
 */

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicChatParams {
  messages: AnthropicMessage[];
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
}

export type AnthropicChatResult =
  | {
      ok: true;
      message: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
    }
  | { ok: false; error: string };

/**
 * Call Anthropic Messages API
 */
export async function callAnthropic(
  apiKey: string,
  params: AnthropicChatParams,
): Promise<AnthropicChatResult> {
  const model = params.model || "claude-sonnet-4-20250514";
  const maxTokens = params.maxTokens || 1024;

  // Anthropic requires alternating user/assistant messages starting with user
  // Merge consecutive same-role messages if needed
  const messages = normalizeMessages(params.messages);

  const body: Record<string, any> = {
    model,
    max_tokens: maxTokens,
    messages,
  };

  if (params.systemPrompt) {
    body.system = params.systemPrompt;
  }

  try {
    console.log(
      `[Anthropic] Calling ${model} with ${messages.length} messages`,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[Anthropic] HTTP ${response.status}: ${errorText}`);

      if (response.status === 401) {
        return { ok: false, error: "Anthropic API key is invalid or expired" };
      }
      if (response.status === 429) {
        return { ok: false, error: "Anthropic rate limit exceeded" };
      }
      if (response.status === 529) {
        return { ok: false, error: "Anthropic API is overloaded" };
      }

      return { ok: false, error: `Anthropic API error (${response.status})` };
    }

    const data = await response.json();

    // Extract text from content blocks
    const textBlocks = (data.content || []).filter(
      (block: any) => block.type === "text",
    );
    const text = textBlocks.map((block: any) => block.text).join("");

    if (!text) {
      console.warn(
        "[Anthropic] Response missing text content:",
        JSON.stringify(data.content),
      );
      return { ok: false, error: "Anthropic response contained no text" };
    }

    console.log(
      `[Anthropic] Received ${text.length} chars, model=${data.model}`,
    );

    return {
      ok: true,
      message: text,
      model: data.model || model,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };
  } catch (error) {
    if ((error as any).name === "AbortError") {
      console.error("[Anthropic] Request timeout (60s)");
      return { ok: false, error: "Anthropic request timed out" };
    }

    console.error("[Anthropic] Request failed:", error);
    return { ok: false, error: "Failed to connect to Anthropic API" };
  }
}

/**
 * Normalize messages for Anthropic format:
 * - Must alternate user/assistant
 * - Must start with user
 * - Merge consecutive same-role messages
 */
function normalizeMessages(messages: AnthropicMessage[]): AnthropicMessage[] {
  if (!messages.length) return [];

  const result: AnthropicMessage[] = [];

  for (const msg of messages) {
    const last = result[result.length - 1];
    if (last && last.role === msg.role) {
      // Merge consecutive same-role messages
      last.content += "\n\n" + msg.content;
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }

  // Ensure first message is from user
  if (result.length > 0 && result[0].role !== "user") {
    result.unshift({ role: "user", content: "(continuing conversation)" });
  }

  return result;
}

/**
 * Test Anthropic API connectivity
 */
export async function testAnthropicConnection(apiKey: string): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (response.ok) {
      return { ok: true, latencyMs };
    }

    if (response.status === 401) {
      return { ok: false, latencyMs, error: "Invalid API key" };
    }

    return { ok: false, latencyMs, error: `Status ${response.status}` };
  } catch (error) {
    const latencyMs = Date.now() - start;
    if ((error as any).name === "AbortError") {
      return { ok: false, latencyMs, error: "Connection timed out" };
    }
    return { ok: false, latencyMs, error: "Connection failed" };
  }
}
