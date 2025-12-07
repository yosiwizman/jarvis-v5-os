/**
 * Conversation Store
 * 
 * Persistent storage for J.A.R.V.I.S. conversations with search and retrieval capabilities.
 * Stores conversations as JSON files with indexed metadata for fast searching.
 */

import { randomUUID } from 'crypto';
import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONVERSATIONS_DIR = path.join(DATA_DIR, 'conversations');
const INDEX_FILE = path.join(CONVERSATIONS_DIR, 'index.json');

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO 8601
  functionCalls?: Array<{
    name: string;
    arguments: string;
    result?: any;
  }>;
  imageUrl?: string;
}

export interface Conversation {
  id: string;
  userId?: string;
  title?: string;
  summary?: string;
  messages: ConversationMessage[];
  tags: string[];
  startedAt: string; // ISO 8601
  lastMessageAt: string; // ISO 8601
  messageCount: number;
  source: 'chat' | 'voice' | 'realtime'; // Where conversation occurred
}

export interface ConversationIndex {
  id: string;
  title?: string;
  summary?: string;
  tags: string[];
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  source: 'chat' | 'voice' | 'realtime';
}

export interface SearchQuery {
  query?: string; // Search in messages and metadata
  tags?: string[];
  source?: 'chat' | 'voice' | 'realtime';
  startDate?: string; // ISO 8601
  endDate?: string; // ISO 8601
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  conversations: ConversationIndex[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Initialize conversation storage directories and index
 */
export async function initConversationStore(): Promise<void> {
  try {
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }
    if (!existsSync(CONVERSATIONS_DIR)) {
      await mkdir(CONVERSATIONS_DIR, { recursive: true });
    }
    if (!existsSync(INDEX_FILE)) {
      await writeFile(INDEX_FILE, JSON.stringify({ conversations: [] }, null, 2), 'utf-8');
    }
    console.log('[ConversationStore] Initialized');
  } catch (error) {
    console.error('[ConversationStore] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Load the conversation index from disk
 */
async function loadIndex(): Promise<ConversationIndex[]> {
  try {
    const content = await readFile(INDEX_FILE, 'utf-8');
    const data = JSON.parse(content);
    return data.conversations || [];
  } catch (error) {
    console.error('[ConversationStore] Failed to load index:', error);
    return [];
  }
}

/**
 * Save the conversation index to disk
 */
async function saveIndex(conversations: ConversationIndex[]): Promise<void> {
  try {
    await writeFile(
      INDEX_FILE,
      JSON.stringify({ conversations, lastUpdated: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('[ConversationStore] Failed to save index:', error);
    throw error;
  }
}

/**
 * Save a conversation to storage
 */
export async function saveConversation(conversation: Conversation): Promise<void> {
  try {
    // Ensure directories exist
    if (!existsSync(CONVERSATIONS_DIR)) {
      await mkdir(CONVERSATIONS_DIR, { recursive: true });
    }

    // Save conversation file
    const filePath = path.join(CONVERSATIONS_DIR, `${conversation.id}.json`);
    await writeFile(filePath, JSON.stringify(conversation, null, 2), 'utf-8');

    // Update index
    const index = await loadIndex();
    const existingIndex = index.findIndex(c => c.id === conversation.id);

    const indexEntry: ConversationIndex = {
      id: conversation.id,
      title: conversation.title,
      summary: conversation.summary,
      tags: conversation.tags,
      startedAt: conversation.startedAt,
      lastMessageAt: conversation.lastMessageAt,
      messageCount: conversation.messageCount,
      source: conversation.source
    };

    if (existingIndex >= 0) {
      index[existingIndex] = indexEntry;
    } else {
      index.push(indexEntry);
    }

    // Sort by most recent first
    index.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    await saveIndex(index);

    console.log(`[ConversationStore] Saved conversation ${conversation.id} (${conversation.messageCount} messages)`);
  } catch (error) {
    console.error('[ConversationStore] Failed to save conversation:', error);
    throw error;
  }
}

/**
 * Retrieve a conversation by ID
 */
export async function getConversation(id: string): Promise<Conversation | null> {
  try {
    const filePath = path.join(CONVERSATIONS_DIR, `${id}.json`);
    if (!existsSync(filePath)) {
      return null;
    }
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as Conversation;
  } catch (error) {
    console.error(`[ConversationStore] Failed to load conversation ${id}:`, error);
    return null;
  }
}

/**
 * List recent conversations (from index)
 */
export async function listConversations(limit: number = 50, offset: number = 0): Promise<SearchResult> {
  try {
    const index = await loadIndex();
    const total = index.length;
    const conversations = index.slice(offset, offset + limit);

    return {
      conversations,
      total,
      limit,
      offset
    };
  } catch (error) {
    console.error('[ConversationStore] Failed to list conversations:', error);
    return { conversations: [], total: 0, limit, offset };
  }
}

/**
 * Search conversations based on query criteria
 */
export async function searchConversations(query: SearchQuery): Promise<SearchResult> {
  try {
    let index = await loadIndex();

    // Filter by date range
    if (query.startDate) {
      const startTime = new Date(query.startDate).getTime();
      index = index.filter(c => new Date(c.lastMessageAt).getTime() >= startTime);
    }
    if (query.endDate) {
      const endTime = new Date(query.endDate).getTime();
      index = index.filter(c => new Date(c.startedAt).getTime() <= endTime);
    }

    // Filter by source
    if (query.source) {
      index = index.filter(c => c.source === query.source);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      index = index.filter(c => query.tags!.some(tag => c.tags.includes(tag)));
    }

    // Text search in title and summary
    if (query.query) {
      const searchLower = query.query.toLowerCase();
      index = index.filter(c => {
        const titleMatch = c.title?.toLowerCase().includes(searchLower);
        const summaryMatch = c.summary?.toLowerCase().includes(searchLower);
        return titleMatch || summaryMatch;
      });

      // If text search, also search in full conversation content
      const detailedResults: ConversationIndex[] = [];
      for (const convIndex of index) {
        const conversation = await getConversation(convIndex.id);
        if (!conversation) continue;

        // Search in message content
        const hasMatch = conversation.messages.some(msg =>
          msg.content.toLowerCase().includes(searchLower)
        );

        if (hasMatch) {
          detailedResults.push(convIndex);
        }
      }

      // Combine results and deduplicate
      const combined = [...index, ...detailedResults];
      const uniqueIds = new Set<string>();
      index = combined.filter(c => {
        if (uniqueIds.has(c.id)) return false;
        uniqueIds.add(c.id);
        return true;
      });
    }

    const total = index.length;
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const conversations = index.slice(offset, offset + limit);

    return {
      conversations,
      total,
      limit,
      offset
    };
  } catch (error) {
    console.error('[ConversationStore] Failed to search conversations:', error);
    return { conversations: [], total: 0, limit: query.limit || 50, offset: query.offset || 0 };
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<boolean> {
  try {
    const filePath = path.join(CONVERSATIONS_DIR, `${id}.json`);
    
    // Remove from index
    const index = await loadIndex();
    const filtered = index.filter(c => c.id !== id);
    await saveIndex(filtered);

    // Delete file if exists
    if (existsSync(filePath)) {
      await writeFile(filePath, '', 'utf-8'); // Clear content first
      // Note: On Windows, using unlink might fail, so we clear content instead
    }

    console.log(`[ConversationStore] Deleted conversation ${id}`);
    return true;
  } catch (error) {
    console.error(`[ConversationStore] Failed to delete conversation ${id}:`, error);
    return false;
  }
}

/**
 * Create a new conversation
 */
export function createConversation(options: {
  userId?: string;
  title?: string;
  tags?: string[];
  source: 'chat' | 'voice' | 'realtime';
}): Conversation {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    userId: options.userId,
    title: options.title,
    tags: options.tags || [],
    messages: [],
    startedAt: now,
    lastMessageAt: now,
    messageCount: 0,
    source: options.source
  };
}

/**
 * Add a message to a conversation
 */
export function addMessage(
  conversation: Conversation,
  message: Omit<ConversationMessage, 'id' | 'timestamp'>
): Conversation {
  const timestamp = new Date().toISOString();
  const newMessage: ConversationMessage = {
    id: randomUUID(),
    timestamp,
    ...message
  };

  return {
    ...conversation,
    messages: [...conversation.messages, newMessage],
    lastMessageAt: timestamp,
    messageCount: conversation.messageCount + 1
  };
}

/**
 * Get conversation statistics
 */
export async function getStats(): Promise<{
  totalConversations: number;
  totalMessages: number;
  bySource: Record<string, number>;
  recentActivity: { date: string; count: number }[];
}> {
  try {
    const index = await loadIndex();
    const totalConversations = index.length;
    let totalMessages = 0;
    const bySource: Record<string, number> = { chat: 0, voice: 0, realtime: 0 };

    // Count by source and messages
    for (const conv of index) {
      totalMessages += conv.messageCount;
      bySource[conv.source] = (bySource[conv.source] || 0) + 1;
    }

    // Recent activity (last 7 days)
    const recentActivity: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const count = index.filter(c => {
        const convDate = c.lastMessageAt.split('T')[0];
        return convDate === dateStr;
      }).length;

      recentActivity.push({ date: dateStr, count });
    }

    return {
      totalConversations,
      totalMessages,
      bySource,
      recentActivity
    };
  } catch (error) {
    console.error('[ConversationStore] Failed to get stats:', error);
    return {
      totalConversations: 0,
      totalMessages: 0,
      bySource: { chat: 0, voice: 0, realtime: 0 },
      recentActivity: []
    };
  }
}
