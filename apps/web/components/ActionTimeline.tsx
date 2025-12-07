'use client';

import React, { useEffect, useState } from 'react';
import { buildServerUrl } from '@/lib/api';

type ActionType =
  | 'notification_scheduled'
  | 'notification_delivered'
  | 'notification_dismissed'
  | 'settings_changed'
  | 'reminder_set'
  | 'function_executed'
  | 'security_event'
  | 'camera_motion'
  | 'image_generated'
  | '3d_model_generated'
  | 'navigation'
  | 'file_uploaded'
  | 'integration_connected'
  | 'integration_disconnected';

interface Action {
  id: string;
  type: ActionType;
  timestamp: string;
  userId?: string;
  metadata: Record<string, any>;
  source: 'user' | 'system' | 'integration';
  description?: string;
}

const actionIcons: Record<ActionType, string> = {
  notification_scheduled: '📅',
  notification_delivered: '🔔',
  notification_dismissed: '🔕',
  settings_changed: '⚙️',
  reminder_set: '⏰',
  function_executed: '⚡',
  security_event: '🔒',
  camera_motion: '📹',
  image_generated: '🖼️',
  '3d_model_generated': '🗿',
  navigation: '🧭',
  file_uploaded: '📁',
  integration_connected: '🔗',
  integration_disconnected: '🔌'
};

const actionLabels: Record<ActionType, string> = {
  notification_scheduled: 'Notification Scheduled',
  notification_delivered: 'Notification Delivered',
  notification_dismissed: 'Notification Dismissed',
  settings_changed: 'Settings Changed',
  reminder_set: 'Reminder Set',
  function_executed: 'Function Executed',
  security_event: 'Security Event',
  camera_motion: 'Camera Motion',
  image_generated: 'Image Generated',
  '3d_model_generated': '3D Model Generated',
  navigation: 'Navigation',
  file_uploaded: 'File Uploaded',
  integration_connected: 'Integration Connected',
  integration_disconnected: 'Integration Disconnected'
};

const sourceColors: Record<string, string> = {
  user: 'text-sky-400',
  system: 'text-purple-400',
  integration: 'text-green-400'
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function ActionTimeline() {
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const loadActions = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ 
        limit: limit.toString(), 
        offset: offset.toString() 
      });
      
      if (typeFilter && typeFilter !== 'all') {
        params.set('type', typeFilter);
      }
      
      if (sourceFilter && sourceFilter !== 'all') {
        params.set('source', sourceFilter);
      }

      const response = await fetch(buildServerUrl(`/api/actions?${params.toString()}`));
      
      if (!response.ok) {
        throw new Error('Failed to load actions');
      }

      const data = await response.json();
      setActions(data.actions || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load actions');
      console.error('[ActionTimeline] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, [typeFilter, sourceFilter, offset]);

  if (loading && actions.length === 0) {
    return (
      <div className="card p-6">
        <div className="text-center text-white/60">Loading action timeline...</div>
      </div>
    );
  }

  if (error && actions.length === 0) {
    return (
      <div className="card p-6">
        <div className="text-center text-red-400">Error: {error}</div>
        <button 
          onClick={() => loadActions()}
          className="btn btn-secondary mt-4 mx-auto"
        >
          Retry
        </button>
      </div>
    );
  }

  // Group actions by date
  const groupedActions: Record<string, Action[]> = {};
  actions.forEach((action) => {
    const date = new Date(action.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!groupedActions[date]) {
      groupedActions[date] = [];
    }
    groupedActions[date].push(action);
  });

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Action Timeline</h3>
          <p className="text-sm text-white/60">{total} action{total !== 1 ? 's' : ''} recorded</p>
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setOffset(0);
            }}
            className="bg-transparent border border-white/10 rounded-lg px-3 py-1 text-sm"
          >
            <option className="bg-[#0b0f14]" value="all">All Types</option>
            <option className="bg-[#0b0f14]" value="function_executed">Functions</option>
            <option className="bg-[#0b0f14]" value="image_generated">Images</option>
            <option className="bg-[#0b0f14]" value="3d_model_generated">3D Models</option>
            <option className="bg-[#0b0f14]" value="notification_delivered">Notifications</option>
            <option className="bg-[#0b0f14]" value="security_event">Security</option>
            <option className="bg-[#0b0f14]" value="settings_changed">Settings</option>
          </select>
          
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setOffset(0);
            }}
            className="bg-transparent border border-white/10 rounded-lg px-3 py-1 text-sm"
          >
            <option className="bg-[#0b0f14]" value="all">All Sources</option>
            <option className="bg-[#0b0f14]" value="user">User</option>
            <option className="bg-[#0b0f14]" value="system">System</option>
            <option className="bg-[#0b0f14]" value="integration">Integration</option>
          </select>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">⚡</div>
          <div className="text-white/60">No actions found</div>
          <div className="text-xs text-white/40 mt-1">
            {typeFilter !== 'all' || sourceFilter !== 'all'
              ? 'Try changing your filters'
              : 'Actions will appear here as you use J.A.R.V.I.S.'}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Actions timeline */}
            <div className="space-y-6">
              {Object.entries(groupedActions).map(([date, dateActions]) => (
                <div key={date}>
                  <div className="text-sm font-medium text-white/70 mb-3 sticky top-0 bg-[#0b0f14] py-2 z-10">
                    {date}
                  </div>
                  <div className="space-y-2 relative before:absolute before:left-6 before:top-0 before:bottom-0 before:w-px before:bg-white/10">
                    {dateActions.map((action) => (
                      <div 
                        key={action.id}
                        className={`card p-3 cursor-pointer transition-all ml-12 relative ${
                          selectedAction?.id === action.id 
                            ? 'border-sky-500/50 bg-sky-500/5' 
                            : 'hover:border-white/20'
                        }`}
                        onClick={() => setSelectedAction(action)}
                      >
                        <div className="absolute -left-12 top-3 text-2xl bg-[#0b0f14] px-1">
                          {actionIcons[action.type]}
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white truncate">
                                {actionLabels[action.type]}
                              </span>
                              <span className={`text-xs capitalize ${sourceColors[action.source]}`}>
                                {action.source}
                              </span>
                            </div>
                            {action.description && (
                              <div className="text-xs text-white/60 line-clamp-2">
                                {action.description}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-white/40 flex-shrink-0">
                            {formatDate(action.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Action detail */}
            <div className="card p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              {selectedAction ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 pb-3 border-b border-white/10">
                    <div className="text-3xl">{actionIcons[selectedAction.type]}</div>
                    <div className="flex-1">
                      <h4 className="text-base font-semibold mb-1">
                        {actionLabels[selectedAction.type]}
                      </h4>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`capitalize ${sourceColors[selectedAction.source]}`}>
                          {selectedAction.source}
                        </span>
                        <span className="text-white/40">•</span>
                        <span className="text-white/50">
                          {new Date(selectedAction.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedAction.description && (
                    <div>
                      <div className="text-xs font-medium text-white/50 mb-1">Description</div>
                      <div className="text-sm text-white/80">
                        {selectedAction.description}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium text-white/50 mb-2">Metadata</div>
                    <div className="bg-white/5 rounded-lg p-3 font-mono text-xs overflow-auto max-h-96">
                      <pre className="text-white/70">
                        {JSON.stringify(selectedAction.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {selectedAction.userId && (
                    <div>
                      <div className="text-xs font-medium text-white/50 mb-1">User ID</div>
                      <div className="text-sm text-white/70 font-mono">
                        {selectedAction.userId}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium text-white/50 mb-1">Action ID</div>
                    <div className="text-xs text-white/50 font-mono break-all">
                      {selectedAction.id}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-white/40 py-8">
                  Select an action to view details
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="btn btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-white/60">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="btn btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
