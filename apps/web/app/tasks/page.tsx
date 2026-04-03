"use client";

import React, { useEffect, useState, useCallback } from "react";

type CronTask = {
  id: string;
  name: string;
  schedule: string;
  scheduleHuman: string;
  command: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  status: "success" | "failed" | "running" | "idle";
};

function StatusBadge({ status }: { status: CronTask["status"] }) {
  const styles: Record<CronTask["status"], string> = {
    success: "bg-green-500/20 text-green-300 border-green-500/40",
    failed: "bg-red-500/20 text-red-300 border-red-500/40",
    running: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    idle: "bg-white/10 text-white/50 border-white/20",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function ToggleSwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? "bg-green-500" : "bg-white/20"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function ScheduledTasksPage() {
  const [tasks, setTasks] = useState<CronTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskInput, setNewTaskInput] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleToggle = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, enabled: !t.enabled } : t)),
    );

    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, enabled: !task.enabled }),
      });
      if (!res.ok) {
        // Revert on failure
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, enabled: task.enabled } : t,
          ),
        );
      }
    } catch {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, enabled: task.enabled } : t,
        ),
      );
    }
  };

  const handleAddTask = async () => {
    if (!newTaskInput.trim()) return;
    setAddingTask(true);
    setAddError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: newTaskInput.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to add task: ${res.status}`);
      }
      setNewTaskInput("");
      setShowAddForm(false);
      await fetchTasks();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setAddingTask(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="tasks-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scheduled Tasks</h1>
        <button
          type="button"
          className="btn px-4 py-2 bg-[color:rgb(var(--jarvis-accent)_/_0.15)] border border-[color:rgb(var(--jarvis-accent)_/_0.4)] hover:bg-[color:rgb(var(--jarvis-accent)_/_0.25)] transition-colors"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "Cancel" : "+ Add Task"}
        </button>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <div className="card p-4 space-y-3 border border-[color:rgb(var(--jarvis-accent)_/_0.3)]">
          <label className="block text-sm text-white/60">
            Describe the task in natural language
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={newTaskInput}
              onChange={(e) => setNewTaskInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              placeholder='e.g. "Every day at 9am, check disk usage and alert if over 80%"'
              className="flex-1 bg-black/40 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[color:rgb(var(--jarvis-accent)_/_0.6)]"
              disabled={addingTask}
            />
            <button
              type="button"
              className="btn px-4 py-2 bg-green-500/20 border border-green-500/40 hover:bg-green-500/30 transition-colors disabled:opacity-50"
              onClick={handleAddTask}
              disabled={addingTask || !newTaskInput.trim()}
            >
              {addingTask ? "Adding..." : "Add"}
            </button>
          </div>
          {addError && <p className="text-sm text-red-400">{addError}</p>}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card p-8 text-center text-white/50">
          Loading scheduled tasks...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card p-4 bg-red-500/10 border border-red-500/40 text-red-300">
          <p className="font-semibold">Failed to load tasks</p>
          <p className="text-sm">{error}</p>
          <button
            type="button"
            className="btn mt-2 text-sm"
            onClick={() => {
              setLoading(true);
              fetchTasks();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && tasks.length === 0 && (
        <div className="card p-8 text-center space-y-2">
          <p className="text-white/50">No scheduled tasks configured</p>
          <p className="text-sm text-white/30">
            Click &quot;Add Task&quot; to create your first cron job
          </p>
        </div>
      )}

      {/* Task Card Grid */}
      {!loading && tasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map((task) => {
            const isExpanded = expandedId === task.id;
            return (
              <div
                key={task.id}
                className={`card p-4 space-y-3 cursor-pointer transition-all hover:border-white/30 ${
                  isExpanded
                    ? "border-[color:rgb(var(--jarvis-accent)_/_0.4)] col-span-1 md:col-span-2 xl:col-span-3"
                    : ""
                }`}
                onClick={() => setExpandedId(isExpanded ? null : task.id)}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusBadge status={task.status} />
                    <h3 className="font-semibold truncate">{task.name}</h3>
                  </div>
                  <ToggleSwitch
                    enabled={task.enabled}
                    onToggle={() => handleToggle(task.id)}
                  />
                </div>

                {/* Schedule */}
                <div className="text-sm text-white/60">
                  {task.scheduleHuman}
                </div>

                {/* Run Times */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="text-white/40">Last run:</div>
                  <div className="text-white/70">{task.lastRun || "Never"}</div>
                  <div className="text-white/40">Next run:</div>
                  <div className="text-white/70">{task.nextRun || "N/A"}</div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="pt-3 mt-3 border-t border-white/10 space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="text-white/40">Task ID:</div>
                      <div className="font-mono text-xs text-white/70">
                        {task.id}
                      </div>
                      <div className="text-white/40">Cron expression:</div>
                      <div className="font-mono text-xs text-cyan-400">
                        {task.schedule}
                      </div>
                      <div className="text-white/40">Enabled:</div>
                      <div
                        className={
                          task.enabled ? "text-green-300" : "text-white/50"
                        }
                      >
                        {task.enabled ? "Yes" : "No"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-white/40 mb-1">Command:</div>
                      <pre className="bg-black/40 p-3 rounded border border-white/10 text-sm text-white/80 overflow-x-auto">
                        {task.command}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
