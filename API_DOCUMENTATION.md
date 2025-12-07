# J.A.R.V.I.S. API Documentation

## Memory & Logging System APIs

This document provides detailed information about the conversation, action tracking, and memory APIs implemented in J.A.R.V.I.S. v6.0.

---

## Table of Contents

1. [Conversation Management API](#conversation-management-api)
2. [Action Tracking API](#action-tracking-api)
3. [Notification API](#notification-api)
4. [Data Models](#data-models)
5. [Usage Examples](#usage-examples)

---

## Conversation Management API

### Save Conversation

Save or update a conversation in the conversation store.

**Endpoint:** `POST /api/conversations/save`

**Request Body:**
```json
{
  "id": "uuid-string",
  "source": "chat" | "voice" | "realtime",
  "userId": "optional-user-id",
  "title": "Optional conversation title",
  "summary": "Optional summary",
  "tags": ["tag1", "tag2"],
  "messages": [
    {
      "id": "msg-uuid",
      "role": "user" | "assistant" | "system",
      "content": "Message content",
      "timestamp": "2025-12-06T16:00:00.000Z",
      "functionCalls": [],
      "imageUrl": "optional-image-url"
    }
  ],
  "startedAt": "2025-12-06T16:00:00.000Z",
  "lastMessageAt": "2025-12-06T16:05:00.000Z",
  "messageCount": 5
}
```

**Response:**
```json
{
  "ok": true,
  "conversationId": "uuid-string"
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (missing required fields)
- `500` - Server error

---

### Get Conversation by ID

Retrieve a specific conversation by its ID.

**Endpoint:** `GET /api/conversations/:id`

**Parameters:**
- `id` (path parameter) - Conversation UUID

**Response:**
```json
{
  "ok": true,
  "conversation": {
    "id": "uuid",
    "source": "chat",
    "messages": [...],
    ...
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (invalid ID)
- `404` - Conversation not found
- `500` - Server error

---

### List/Search Conversations

List all conversations or search with filters.

**Endpoint:** `GET /api/conversations`

**Query Parameters:**
- `query` (optional) - Text search in messages, title, and summary
- `tags` (optional) - Comma-separated list of tags to filter by
- `source` (optional) - Filter by source: `chat`, `voice`, or `realtime`
- `startDate` (optional) - ISO 8601 timestamp for date range start
- `endDate` (optional) - ISO 8601 timestamp for date range end
- `limit` (optional, default: 50) - Maximum number of results
- `offset` (optional, default: 0) - Pagination offset

**Example Request:**
```
GET /api/conversations?query=project&tags=work&limit=20
```

**Response:**
```json
{
  "ok": true,
  "conversations": [
    {
      "id": "uuid",
      "title": "Project Discussion",
      "summary": "Discussed project timeline",
      "tags": ["work", "project"],
      "startedAt": "2025-12-05T10:00:00.000Z",
      "lastMessageAt": "2025-12-05T10:30:00.000Z",
      "messageCount": 15,
      "source": "chat"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

**Status Codes:**
- `200` - Success
- `500` - Server error

---

### Delete Conversation

Delete a conversation by ID.

**Endpoint:** `DELETE /api/conversations/:id`

**Parameters:**
- `id` (path parameter) - Conversation UUID

**Response:**
```json
{
  "ok": true
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request
- `404` - Conversation not found
- `500` - Server error

---

### Get Conversation Statistics

Get aggregate statistics about conversations.

**Endpoint:** `GET /api/conversations/stats`

**Response:**
```json
{
  "ok": true,
  "stats": {
    "totalConversations": 42,
    "totalMessages": 523,
    "bySource": {
      "chat": 25,
      "voice": 10,
      "realtime": 7
    },
    "recentActivity": [
      { "date": "2025-12-01", "count": 3 },
      { "date": "2025-12-02", "count": 5 },
      ...
    ]
  }
}
```

**Status Codes:**
- `200` - Success
- `500` - Server error

---

## Action Tracking API

### Record Action

Record a new user or system action.

**Endpoint:** `POST /api/actions/record`

**Request Body:**
```json
{
  "type": "function_executed",
  "source": "user" | "system" | "integration",
  "userId": "optional-user-id",
  "metadata": {
    "functionName": "create_image",
    "prompt": "a sunset over mountains",
    "duration": 5432
  },
  "description": "Generated an image"
}
```

**Action Types:**
- `notification_scheduled`
- `notification_delivered`
- `notification_dismissed`
- `settings_changed`
- `reminder_set`
- `function_executed`
- `security_event`
- `camera_motion`
- `image_generated`
- `3d_model_generated`
- `navigation`
- `file_uploaded`
- `integration_connected`
- `integration_disconnected`

**Response:**
```json
{
  "ok": true,
  "actionId": "uuid-string"
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (missing required fields)
- `500` - Server error

---

### Get Action by ID

Retrieve a specific action by its ID.

**Endpoint:** `GET /api/actions/:id`

**Parameters:**
- `id` (path parameter) - Action UUID

**Response:**
```json
{
  "ok": true,
  "action": {
    "id": "uuid",
    "type": "function_executed",
    "timestamp": "2025-12-06T16:00:00.000Z",
    "source": "user",
    "metadata": {...},
    "description": "Generated an image"
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request
- `404` - Action not found
- `500` - Server error

---

### Query/List Actions

Query actions with optional filters.

**Endpoint:** `GET /api/actions`

**Query Parameters:**
- `type` (optional) - Single action type to filter by
- `types` (optional) - Comma-separated list of action types
- `source` (optional) - Filter by source: `user`, `system`, or `integration`
- `userId` (optional) - Filter by user ID
- `startDate` (optional) - ISO 8601 timestamp for date range start
- `endDate` (optional) - ISO 8601 timestamp for date range end
- `limit` (optional, default: 50) - Maximum number of results
- `offset` (optional, default: 0) - Pagination offset

**Example Request:**
```
GET /api/actions?types=function_executed,image_generated&limit=100
```

**Response:**
```json
{
  "ok": true,
  "actions": [
    {
      "id": "uuid",
      "type": "function_executed",
      "timestamp": "2025-12-06T16:00:00.000Z",
      "source": "user",
      "metadata": {...},
      "description": "Generated an image"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

**Status Codes:**
- `200` - Success
- `500` - Server error

---

### Get Action Statistics

Get aggregate statistics about actions.

**Endpoint:** `GET /api/actions/stats`

**Response:**
```json
{
  "ok": true,
  "stats": {
    "totalActions": 523,
    "byType": {
      "function_executed": 150,
      "image_generated": 45,
      "notification_delivered": 120,
      ...
    },
    "bySource": {
      "user": 300,
      "system": 200,
      "integration": 23
    },
    "recentActivity": [
      { "date": "2025-12-01", "count": 35 },
      ...
    ],
    "topActions": [
      { "type": "function_executed", "count": 150 },
      { "type": "notification_delivered", "count": 120 },
      ...
    ]
  }
}
```

**Status Codes:**
- `200` - Success
- `500` - Server error

---

### Cleanup Old Actions

Remove actions older than specified number of days.

**Endpoint:** `POST /api/actions/cleanup`

**Request Body:**
```json
{
  "days": 90
}
```

**Response:**
```json
{
  "ok": true,
  "deletedCount": 150
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (invalid days value)
- `500` - Server error

---

## Notification API

### Schedule Notification

Schedule a notification to be delivered at a specific time.

**Endpoint:** `POST /api/notifications/schedule`

**Request Body:**
```json
{
  "type": "calendar_reminder",
  "payload": {
    "eventName": "Team Meeting",
    "location": "Conference Room A"
  },
  "triggerAt": "2025-12-07T14:00:00.000Z"
}
```

**Response:**
```json
{
  "ok": true,
  "eventId": "uuid-string"
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (invalid fields)
- `500` - Server error

---

### Get Notification History

Retrieve notification history with optional filtering.

**Endpoint:** `GET /api/notifications/history`

**Query Parameters:**
- `type` (optional) - Filter by notification type
- `limit` (optional, default: 50) - Maximum number of results
- `offset` (optional, default: 0) - Pagination offset

**Response:**
```json
{
  "ok": true,
  "notifications": [...],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

**Status Codes:**
- `200` - Success
- `500` - Server error

---

### Notification Stream (SSE)

Subscribe to real-time notification delivery via Server-Sent Events.

**Endpoint:** `GET /api/notifications/stream`

**Response:** Server-Sent Events stream

**Event Format:**
```
data: {"type":"notification_type","payload":{...},"triggeredAt":"..."}
```

---

## Data Models

### Conversation

```typescript
interface Conversation {
  id: string;
  userId?: string;
  title?: string;
  summary?: string;
  messages: ConversationMessage[];
  tags: string[];
  startedAt: string; // ISO 8601
  lastMessageAt: string; // ISO 8601
  messageCount: number;
  source: 'chat' | 'voice' | 'realtime';
}
```

### ConversationMessage

```typescript
interface ConversationMessage {
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
```

### Action

```typescript
interface Action {
  id: string;
  type: ActionType;
  timestamp: string; // ISO 8601
  userId?: string;
  metadata: Record<string, any>;
  source: 'user' | 'system' | 'integration';
  description?: string;
}
```

---

## Usage Examples

### Example 1: Save a Chat Conversation

```javascript
const conversation = {
  id: crypto.randomUUID(),
  source: 'chat',
  title: 'Project Planning',
  tags: ['work', 'planning'],
  messages: [
    {
      id: crypto.randomUUID(),
      role: 'user',
      content: 'What tasks do we need to complete?',
      timestamp: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Based on our project timeline...',
      timestamp: new Date().toISOString()
    }
  ],
  startedAt: new Date().toISOString(),
  lastMessageAt: new Date().toISOString(),
  messageCount: 2
};

const response = await fetch('/api/conversations/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(conversation)
});

const result = await response.json();
console.log('Saved:', result.conversationId);
```

### Example 2: Search Conversations

```javascript
const response = await fetch(
  '/api/conversations?query=project&tags=work&limit=10'
);

const result = await response.json();
console.log('Found conversations:', result.conversations);
```

### Example 3: Record a Function Execution

```javascript
const action = {
  type: 'function_executed',
  source: 'user',
  metadata: {
    functionName: 'create_image',
    prompt: 'a futuristic city',
    duration: 3456,
    imageUrl: '/files/generated-image.png'
  },
  description: 'Generated an image of a futuristic city'
};

const response = await fetch('/api/actions/record', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(action)
});

const result = await response.json();
console.log('Action recorded:', result.actionId);
```

### Example 4: Get Today's Actions

```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

const response = await fetch(
  `/api/actions?startDate=${today.toISOString()}&limit=100`
);

const result = await response.json();
console.log('Today\'s actions:', result.actions);
```

---

## Error Handling

All API endpoints follow a consistent error response format:

```json
{
  "ok": false,
  "error": "Error message description"
}
```

Common error codes:
- `400` - Bad Request (invalid parameters or missing required fields)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (server-side error)
- `503` - Service Unavailable (dependent service unavailable)

---

## Rate Limiting

Currently, there are no rate limits enforced on these endpoints. However, it's recommended to:
- Use pagination for large result sets
- Implement debouncing for frequent saves
- Cache conversation data on the client side

---

## Logging

All API requests are automatically logged with:
- Request method and URL
- Response status code
- Request duration
- User agent and IP address

Logs are stored in:
- `data/logs/app.log` - All application logs
- `data/logs/error.log` - Error logs only
- `data/logs/actions.log` - User action logs
- `data/logs/security.log` - Security event logs

Logs rotate daily and are kept for 30 days. Old logs are automatically compressed with gzip.

---

## Data Storage

### Conversations
- Stored in `data/conversations/` as individual JSON files
- Index maintained in `data/conversations/index.json`
- No automatic cleanup (managed by user)

### Actions
- Stored in `data/actions/actions.json`
- Automatically limited to 10,000 most recent actions
- Can be cleaned up via `/api/actions/cleanup` endpoint

### Logs
- Stored in `data/logs/` directory
- Daily rotation with 30-day retention
- Automatic gzip compression of old logs

---

## Support

For issues or questions, refer to the main J.A.R.V.I.S. documentation or check the server logs for detailed error information.
