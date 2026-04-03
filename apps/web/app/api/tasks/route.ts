import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * GET /api/tasks
 * Lists all cron jobs via `openclaw cron list --json`.
 * Falls back to reading system crontab if openclaw is unavailable.
 */
export async function GET() {
  try {
    // Try openclaw first
    const { stdout } = await execAsync("openclaw cron list --json", {
      timeout: 10000,
    });
    const data = JSON.parse(stdout);
    return NextResponse.json({ tasks: data.tasks || data });
  } catch {
    // Fallback: parse system crontab
    try {
      const { stdout } = await execAsync('crontab -l 2>/dev/null || echo ""', {
        timeout: 5000,
      });
      const lines = stdout
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("#"));
      const tasks = lines.map((line, i) => {
        const parts = line.trim().split(/\s+/);
        const cronFields = parts.slice(0, 5).join(" ");
        const command = parts.slice(5).join(" ");
        return {
          id: `cron-${i}`,
          name: command.split("/").pop()?.split(" ")[0] || `Task ${i + 1}`,
          schedule: cronFields,
          scheduleHuman: cronToHuman(cronFields),
          command,
          enabled: true,
          lastRun: null,
          nextRun: null,
          status: "idle" as const,
        };
      });
      return NextResponse.json({ tasks });
    } catch {
      return NextResponse.json({ tasks: [] });
    }
  }
}

/**
 * POST /api/tasks
 * Adds a new cron job. Accepts { input: string } with natural language description.
 * Shells out to `openclaw cron add` or falls back to crontab.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { input } = body;

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: 'Missing or invalid "input" field' },
        { status: 400 },
      );
    }

    try {
      // Try openclaw
      const escaped = input.replace(/'/g, "'\\''");
      const { stdout } = await execAsync(`openclaw cron add '${escaped}'`, {
        timeout: 30000,
      });
      return NextResponse.json({ ok: true, result: stdout.trim() });
    } catch {
      return NextResponse.json(
        {
          error:
            "openclaw cron add is not available. Configure openclaw or add cron entries manually.",
        },
        { status: 501 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/tasks
 * Toggles a task's enabled state. Accepts { id: string, enabled: boolean }.
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, enabled } = body;

    if (!id || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Missing id or enabled fields" },
        { status: 400 },
      );
    }

    try {
      const action = enabled ? "enable" : "disable";
      const { stdout } = await execAsync(`openclaw cron ${action} ${id}`, {
        timeout: 10000,
      });
      return NextResponse.json({ ok: true, result: stdout.trim() });
    } catch {
      return NextResponse.json(
        { error: "openclaw cron toggle is not available" },
        { status: 501 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

/**
 * Converts a cron expression to a human-readable string.
 */
function cronToHuman(cron: string): string {
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return cron;

  const [min, hour, dom, mon, dow] = parts;

  // Common patterns
  if (
    min === "*" &&
    hour === "*" &&
    dom === "*" &&
    mon === "*" &&
    dow === "*"
  ) {
    return "Every minute";
  }
  if (
    min === "0" &&
    hour === "*" &&
    dom === "*" &&
    mon === "*" &&
    dow === "*"
  ) {
    return "Every hour";
  }
  if (
    hour === "*" &&
    dom === "*" &&
    mon === "*" &&
    dow === "*" &&
    min !== "*"
  ) {
    return `Every hour at minute ${min}`;
  }
  if (
    dom === "*" &&
    mon === "*" &&
    dow === "*" &&
    hour !== "*" &&
    min !== "*"
  ) {
    return `Daily at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (dom === "*" && mon === "*" && dow !== "*" && hour !== "*") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = days[parseInt(dow)] || dow;
    return `${dayName} at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (min.startsWith("*/")) {
    return `Every ${min.slice(2)} minutes`;
  }
  if (hour.startsWith("*/")) {
    return `Every ${hour.slice(2)} hours`;
  }

  return cron;
}
