'use client';

import React, { useEffect, useState } from 'react';

/**
 * LogViewer Component
 * 
 * This component provides a UI for viewing system logs.
 * 
 * NOTE: This is a placeholder implementation. To fully enable log viewing:
 * 1. Add a log retrieval endpoint to the server (e.g., GET /api/logs)
 * 2. Implement log file parsing and streaming
 * 3. Connect this component to the real endpoint
 * 
 * For now, this shows the intended UI/UX for the log viewer.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type LogCategory = 'app' | 'error' | 'security' | 'actions';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, any>;
}

const levelColors: Record<LogLevel, string> = {
  info: 'text-sky-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  debug: 'text-purple-400'
};

const levelBgColors: Record<LogLevel, string> = {
  info: 'bg-sky-500/10',
  warn: 'bg-yellow-500/10',
  error: 'bg-red-500/10',
  debug: 'bg-purple-500/10'
};

const categoryIcons: Record<LogCategory, string> = {
  app: '📱',
  error: '❌',
  security: '🔒',
  actions: '⚡'
};

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Sample data for demonstration (initialized on client to avoid hydration mismatch)
function createSampleLogs(): LogEntry[] {
  const now = Date.now();
  return [
    {
      id: '1',
      timestamp: new Date(now).toISOString(),
      level: 'info',
      category: 'app',
      message: 'Server started successfully',
      context: { port: 1234, env: 'development' }
    },
    {
      id: '2',
      timestamp: new Date(now - 60000).toISOString(),
      level: 'info',
      category: 'actions',
      message: 'Conversation store initialized',
      context: { conversations: 0 }
    },
    {
      id: '3',
      timestamp: new Date(now - 120000).toISOString(),
      level: 'info',
      category: 'actions',
      message: 'Action store initialized',
      context: { actions: 0 }
    },
    {
      id: '4',
      timestamp: new Date(now - 180000).toISOString(),
      level: 'warn',
      category: 'app',
      message: 'High memory usage detected',
      context: { memoryUsedPct: 85 }
    },
    {
      id: '5',
      timestamp: new Date(now - 240000).toISOString(),
      level: 'info',
      category: 'security',
      message: 'Camera motion detected',
      context: { deviceId: 'camera-1', severity: 'low' }
    }
  ];
}

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    setLogs(createSampleLogs());
  }, []);

  // Filter logs based on search and filters
  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header with search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">System Logs</h3>
          <p className="text-sm text-white/60">
            {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border border-white/10 rounded-lg px-3 py-1 text-sm w-48"
          />
          
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-transparent border border-white/10 rounded-lg px-3 py-1 text-sm"
          >
            <option className="bg-[#0b0f14]" value="all">All Levels</option>
            <option className="bg-[#0b0f14]" value="info">Info</option>
            <option className="bg-[#0b0f14]" value="warn">Warning</option>
            <option className="bg-[#0b0f14]" value="error">Error</option>
            <option className="bg-[#0b0f14]" value="debug">Debug</option>
          </select>
          
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-transparent border border-white/10 rounded-lg px-3 py-1 text-sm"
          >
            <option className="bg-[#0b0f14]" value="all">All Categories</option>
            <option className="bg-[#0b0f14]" value="app">App</option>
            <option className="bg-[#0b0f14]" value="error">Error</option>
            <option className="bg-[#0b0f14]" value="security">Security</option>
            <option className="bg-[#0b0f14]" value="actions">Actions</option>
          </select>
        </div>
      </div>

      {/* Info banner about placeholder state */}
      <div className="card p-4 border-sky-500/30 bg-sky-500/5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-white/90 mb-1">Log Viewer (Demo Mode)</div>
            <div className="text-xs text-white/60">
              This is a demo of the log viewer UI. To enable live log viewing, implement the log retrieval API endpoint.
              Logs are currently stored in <code className="text-white/80 bg-white/10 px-1 rounded">data/logs/</code> with automatic rotation and compression.
            </div>
          </div>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-white/60">No logs found</div>
          <div className="text-xs text-white/40 mt-1">
            Try changing your search or filters
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Log entries list */}
          <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`card p-3 cursor-pointer transition-all ${
                  selectedLog?.id === log.id
                    ? 'border-sky-500/50 bg-sky-500/5'
                    : 'hover:border-white/20'
                }`}
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">
                    {categoryIcons[log.category]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium uppercase px-2 py-0.5 rounded ${levelBgColors[log.level]} ${levelColors[log.level]}`}
                      >
                        {log.level}
                      </span>
                      <span className="text-xs text-white/40">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm text-white/80 line-clamp-2">
                      {log.message}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Log detail view */}
          <div className="card p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto">
            {selectedLog ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 pb-3 border-b border-white/10">
                  <span className="text-3xl">{categoryIcons[selectedLog.category]}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-medium uppercase px-2 py-1 rounded ${levelBgColors[selectedLog.level]} ${levelColors[selectedLog.level]}`}
                      >
                        {selectedLog.level}
                      </span>
                      <span className="text-xs text-white/50 capitalize">
                        {selectedLog.category}
                      </span>
                    </div>
                    <div className="text-xs text-white/50">
                      {new Date(selectedLog.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-white/50 mb-2">Message</div>
                  <div className="text-sm text-white/90 leading-relaxed">
                    {selectedLog.message}
                  </div>
                </div>

                {selectedLog.context && Object.keys(selectedLog.context).length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-white/50 mb-2">Context</div>
                    <div className="bg-white/5 rounded-lg p-3 font-mono text-xs overflow-auto">
                      <pre className="text-white/70">
                        {JSON.stringify(selectedLog.context, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-medium text-white/50 mb-1">Log ID</div>
                  <div className="text-xs text-white/50 font-mono">
                    {selectedLog.id}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-white/40 py-8">
                Select a log entry to view details
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-white/60">
            Logs are automatically rotated daily and kept for 30 days
          </div>
          <div className="flex gap-2">
            <button 
              className="btn btn-secondary text-sm"
              onClick={() => alert('Export functionality coming soon!')}
            >
              Export Logs
            </button>
            <button 
              className="btn btn-secondary text-sm"
              onClick={() => alert('Download functionality coming soon!')}
            >
              Download Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
