# @helios-starling/starling

<div align="center">
  
[![npm version](https://img.shields.io/npm/v/@helios-starling/starling.svg?style=flat-square)](https://www.npmjs.org/package/@helios-starling/starling)
[![install size](https://img.shields.io/bundlephobia/min/@helios-starling/starling?style=flat-square)](https://bundlephobia.com/result?p=@helios-starling/starling)
[![npm downloads](https://img.shields.io/npm/dm/@helios-starling/starling.svg?style=flat-square)](https://npm-stat.com/charts.html?package=@helios-starling/starling)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)
  
</div>

<p align="center">
  <strong>High-performance WebSocket client for the Helios-Starling protocol</strong>
</p>

<p align="center">
  <a href="#key-features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#usage">Usage</a> •
  <a href="#advanced">Advanced</a> •
  <a href="#api">API</a>
</p>

## Overview

Starling is a robust WebSocket client implementation of the Helios-Starling protocol, providing a powerful abstraction for real-time client-server communication. It offers advanced features like automatic reconnection, state management, request queuing, and sophisticated error handling.

## Key Features

- **Robust Connection Management**
  - Automatic reconnection with exponential backoff
  - Connection state recovery
  - Comprehensive connection lifecycle events
  
- **Advanced Request Handling**
  - Request/Response pattern support
  - Automatic timeout handling
  - Request queuing during disconnections
  - Priority-based request processing
  
- **State Management**
  - Automatic state synchronization
  - Recovery token management
  - State persistence across reconnections
  
- **Pub/Sub System**
  - Topic-based subscription
  - Pattern matching for topic subscriptions
  - Message filtering
  
- **Performance Optimized**
  - Message buffering
  - Batch processing
  - Connection pooling
  
- **Developer Experience**
  - TypeScript support
  - Comprehensive debugging
  - Detailed metrics and monitoring

## Installation

```bash
bun install @helios-starling/starling
```

## Quick Start

```javascript
import { createClient } from '@helios-starling/starling';

// Create a client instance
const client = createClient('ws://localhost:8080', {
  reconnect: true,
  debug: true
});

// Register a method handler
client.method('chat:receive', async (context) => {
  console.log(`Message received: ${context.payload.message}`);
  context.success({ received: true });
});

// Connect to the server
await client.connect();

// Send a request
const response = await client.request('chat:send', { 
  message: 'Hello!' 
});

// Subscribe to notifications
client.on('chat:typing', (notification) => {
  console.log(`${notification.data.user} is typing...`);
});
```

## Usage

### Connection Management

```javascript
const client = createClient('ws://localhost:8080', {
  connectTimeout: 5000,
  reconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 5
});

// Connect with error handling
try {
  await client.connect();
  console.log('Connected!');
} catch (error) {
  console.error('Connection failed:', error);
}

// Monitor connection state
client.events.on('starling:connected', () => {
  console.log('Connected to server');
});

client.events.on('starling:disconnected', () => {
  console.log('Disconnected from server');
});

// Graceful disconnection
await client.disconnect('Shutting down');
```

### Request Handling

```javascript
// Simple request
const response = await client.request('user:get', { id: 123 });

// Request with options
const result = await client.request('data:fetch', { query: 'select' }, {
  timeout: 10000,
  retry: true,
  metadata: {
    priority: 1
  }
});

// Handle progress updates
const download = await client.request('file:download', { path: '/data.zip' })
  .onProgress((progress) => {
    console.log(`Downloaded: ${progress}%`);
  });

// Method registration
client.method('compute:sum', async (context) => {
  const { numbers } = context.payload;
  const sum = numbers.reduce((a, b) => a + b, 0);
  context.success({ result: sum });
});
```

### Topic Subscription

```javascript
// Simple subscription
client.on('user:presence', (notification) => {
  console.log(`User ${notification.data.userId} is ${notification.data.status}`);
});

// Pattern matching
client.on('chat:*', (notification) => {
  console.log(`Chat event: ${notification.topic}`);
});

// With options
client.on('system:metrics', handleMetrics, {
  persistent: true,
  priority: 10,
  filter: (data) => data.importance === 'high'
});
```

### State Management

```javascript
// Access state manager
const state = client.state;

// Force state refresh
await state.refresh({ force: true });

// Monitor state changes
client.events.on('state:refreshed', ({ token }) => {
  console.log('New recovery token:', token);
});

// Get connection metrics
const metrics = state.metrics;
console.log(`Uptime: ${metrics.uptime}ms`);
```

## Advanced Features

### Custom Message Handling

```javascript
// Handle raw text messages
client.onText((context) => {
  console.log('Received text:', context.content);
});

// Handle JSON messages
client.onJson((context) => {
  console.log('Received JSON:', context.data);
});

// Handle binary messages
client.onBinary((context) => {
  console.log('Received binary data:', context.data);
});
```

### Request Queue Configuration

```javascript
const client = createClient('ws://localhost:8080', {
  requests: {
    maxSize: 1000,
    maxRetries: 3,
    baseDelay: 1000,
    maxConcurrent: 10,
    priorityQueuing: true,
    onFull: 'block',
    drainTimeout: 30000
  }
});
```

### Reconnection Strategy

```javascript
const client = createClient('ws://localhost:8080', {
  reconnection: {
    minDelay: 100,
    maxDelay: 30000,
    maxAttempts: 10,
    backoffMultiplier: 1.5,
    resetThreshold: 60000
  }
});

// Monitor reconnection attempts
client.events.on('starling:reconnect:attempt', (event) => {
  console.log(`Reconnection attempt ${event.attempt}`);
});

client.events.on('starling:reconnect:success', () => {
  console.log('Reconnected successfully');
});
```

## API Reference

### Client Creation

```typescript
function createClient(url: string | URL, options?: StarlingOptions): Starling;

interface StarlingOptions {
  connectTimeout?: number;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  state?: {
    refreshInterval?: number;
    minRefreshInterval?: number;
    retryAttempts?: number;
    forceRefreshOnReconnect?: boolean;
  };
}
```

### Starling Class

```typescript
class Starling {
  // Connection management
  connect(): Promise<void>;
  disconnect(reason?: string): Promise<void>;
  sync(): Promise<string>;
  
  // Request handling
  request(method: string, payload?: any, options?: RequestOptions): Request;
  method(name: string, handler: MethodHandler, options?: MethodOptions): void;
  
  // Pub/Sub
  on(topic: string, handler: NotificationHandler, options?: TopicOptions): void;
  notify(topic: string, data: any, requestId?: string): void;
  
  // Message handling
  onText(callback: (context: TextMessageContext) => void): void;
  onJson(callback: (context: JsonMessageContext) => void): void;
  onBinary(callback: (context: BinaryMessageContext) => void): void;
  
  // Properties
  readonly connected: boolean;
  readonly connecting: boolean;
  readonly closing: boolean;
  readonly closed: boolean;
}
```

## Events

| Event                    | Description                        | Data                           |
|-------------------------|------------------------------------|--------------------------------|
| starling:connected      | Connection established             | { timestamp }                  |
| starling:disconnected   | Connection lost                    | { lastConnected, timestamp }   |
| starling:reconnect:attempt | Reconnection attempted          | { attempt, metrics }           |
| state:refreshed         | State token refreshed              | { token, metrics }             |
| message:send:success    | Message sent successfully          | { message }                    |
| message:send:failed     | Message send failed                | { error }                      |

## Error Handling

The client provides comprehensive error handling with structured error objects:

```typescript
interface StarlingError {
  code: string;
  message: string;
  details?: any;
}
```

Common error codes:
- `CONNECTION_FAILED`: Initial connection failed
- `CONNECTION_LOST`: Connection lost unexpectedly
- `REQUEST_TIMEOUT`: Request timed out
- `REQUEST_FAILED`: Request failed to execute
- `STATE_REFRESH_FAILED`: Failed to refresh state token
- `INVALID_MESSAGE`: Invalid message received

## Testing

Integration with test frameworks:

```javascript
import { createClient } from '@helios-starling/starling';
import { MockWebSocket } from '@helios-starling/starling/testing';

describe('Starling Client', () => {
  let client;
  
  beforeEach(() => {
    client = createClient('ws://test', {
      websocket: MockWebSocket
    });
  });
  
  it('should connect successfully', async () => {
    await client.connect();
    expect(client.connected).toBe(true);
  });
});
```

## License

MIT