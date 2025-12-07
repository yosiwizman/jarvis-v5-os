'use client';

import React, { useEffect, useState } from 'react';
import { buildServerUrl } from '@/lib/api';

interface ConversationIndex {
  id: string;
  title?: string;
  summary?: string;
  tags: string[];
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  source: 'chat' | 'voice' | 'realtime';
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  functionCalls?: Array<{
    name: string;
    arguments: string;
    result?: any;
  }>;
  imageUrl?: string;
}

interface Conversation {
  id: string;
  title?: string;
  summary?: string;
  tags: string[];
  messages: ConversationMessage[];
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  source: 'chat' | 'voice' | 'realtime';
}

const sourceIcons: Record<string, string> = {
  chat: '💬',
  voice: '🎙️',
  realtime: '⚡'
};

const sourceLabels: Record<string, string> = {
  chat: 'Chat',
  voice: 'Voice',
  realtime: 'Real-time'
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

export function ConversationHistory() {
  const [conversations, setConversations] = useState<ConversationIndex[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const loadConversations = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ 
        limit: limit.toString(), 
        offset: offset.toString() 
      });
      
      if (searchQuery) {
        params.set('query', searchQuery);
      }
      
      if (sourceFilter && sourceFilter !== 'all') {
        params.set('source', sourceFilter);
      }

      const response = await fetch(buildServerUrl(`/api/conversations?${params.toString()}`));
      
      if (!response.ok) {
        throw new Error('Failed to load conversations');
      }

      const data = await response.json();
      setConversations(data.conversations || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
      console.error('[ConversationHistory] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadConversationDetail = async (id: string) => {
    setLoadingDetail(true);
    setError(null);

    try {
      const response = await fetch(buildServerUrl(`/api/conversations/${id}`));
      
      if (!response.ok) {
        throw new Error('Failed to load conversation details');
      }

      const data = await response.json();
      setSelectedConversation(data.conversation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation details');
      console.error('[ConversationHistory] Detail load error:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const deleteConversation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(buildServerUrl(`/api/conversations/${id}`), {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      // Refresh the list and close detail view if deleted conversation was selected
      if (selectedConversation?.id === id) {
        setSelectedConversation(null);
      }
      loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
      console.error('[ConversationHistory] Delete error:', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [searchQuery, sourceFilter, offset]);

  if (loading && conversations.length === 0) {
    return (
      <div className="card p-6">
        <div className="text-center text-white/60">Loading conversation history...</div>
      </div>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <div className="card p-6">
        <div className="text-center text-red-400">Error: {error}</div>
        <button 
          onClick={() => loadConversations()}
          className="btn btn-secondary mt-4 mx-auto"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Conversation History</h3>
          <p className="text-sm text-white/60">{total} conversation{total !== 1 ? 's' : ''}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOffset(0);
            }}
            className="bg-transparent border border-white/10 rounded-lg px-3 py-1 text-sm w-48"
          />
          
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setOffset(0);
            }}
            className="bg-transparent border border-white/10 rounded-lg px-3 py-1 text-sm"
          >
            <option className="bg-[#0b0f14]" value="all">All Sources</option>
            <option className="bg-[#0b0f14]" value="chat">Chat</option>
            <option className="bg-[#0b0f14]" value="voice">Voice</option>
            <option className="bg-[#0b0f14]" value="realtime">Real-time</option>
          </select>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">💬</div>
          <div className="text-white/60">No conversations found</div>
          <div className="text-xs text-white/40 mt-1">
            {searchQuery || sourceFilter !== 'all' 
              ? 'Try changing your search or filters' 
              : 'Start a conversation to see it here'}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Conversations list */}
            <div className="space-y-3">
              {conversations.map((conv) => (
                <div 
                  key={conv.id}
                  className={`card p-4 cursor-pointer transition-all ${
                    selectedConversation?.id === conv.id 
                      ? 'border-sky-500/50 bg-sky-500/5' 
                      : 'hover:border-white/20'
                  }`}
                  onClick={() => loadConversationDetail(conv.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0">
                      {sourceIcons[conv.source]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white truncate">
                          {conv.title || `${sourceLabels[conv.source]} Conversation`}
                        </span>
                        <span className="text-xs text-white/40 flex-shrink-0">
                          {formatDate(conv.lastMessageAt)}
                        </span>
                      </div>
                      {conv.summary && (
                        <div className="text-xs text-white/60 line-clamp-2 mb-2">
                          {conv.summary}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-white/50">{conv.messageCount} messages</span>
                        {conv.tags.length > 0 && (
                          <div className="flex gap-1">
                            {conv.tags.slice(0, 2).map((tag) => (
                              <span 
                                key={tag}
                                className="px-2 py-0.5 rounded-full bg-white/5 text-white/60"
                              >
                                {tag}
                              </span>
                            ))}
                            {conv.tags.length > 2 && (
                              <span className="text-white/40">+{conv.tags.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Conversation detail */}
            <div className="card p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              {selectedConversation ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between pb-3 border-b border-white/10">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{sourceIcons[selectedConversation.source]}</span>
                        <h4 className="text-base font-semibold">
                          {selectedConversation.title || `${sourceLabels[selectedConversation.source]} Conversation`}
                        </h4>
                      </div>
                      <div className="text-xs text-white/50">
                        {new Date(selectedConversation.startedAt).toLocaleString()}
                      </div>
                      {selectedConversation.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {selectedConversation.tags.map((tag) => (
                            <span 
                              key={tag}
                              className="px-2 py-0.5 rounded-full bg-white/5 text-white/60 text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteConversation(selectedConversation.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                      title="Delete conversation"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="space-y-3">
                    {selectedConversation.messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={`p-3 rounded-lg ${
                          msg.role === 'user' 
                            ? 'bg-sky-500/10 border border-sky-500/20' 
                            : msg.role === 'assistant'
                            ? 'bg-white/5 border border-white/10'
                            : 'bg-yellow-500/10 border border-yellow-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-white/70 capitalize">
                            {msg.role}
                          </span>
                          <span className="text-xs text-white/40">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm text-white/80 whitespace-pre-wrap">
                          {msg.content}
                        </div>
                        {msg.imageUrl && (
                          <img 
                            src={msg.imageUrl} 
                            alt="Message attachment"
                            className="mt-2 rounded-lg max-w-full h-auto"
                          />
                        )}
                        {msg.functionCalls && msg.functionCalls.length > 0 && (
                          <div className="mt-2 text-xs text-white/50">
                            Function: {msg.functionCalls[0].name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : loadingDetail ? (
                <div className="text-center text-white/60 py-8">
                  Loading conversation details...
                </div>
              ) : (
                <div className="text-center text-white/40 py-8">
                  Select a conversation to view details
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
