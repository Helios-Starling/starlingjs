# @helios-starling/starling

[![npm version](https://img.shields.io/npm/v/@helios-starling/starling.svg)](https://www.npmjs.com/package/@helios-starling/starling)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)

Modern WebSocket client for the Helios-Starling protocol. Handles automatic reconnection, message buffering, and state persistence.

## Features

- 🔄 **Automatic Management**
  - Smart reconnection with exponential backoff
  - Message buffering during disconnections
  - Session recovery via JWT
  
- 📡 **RPC API**
  - Typed request/response
  - Timeout support
  - Standardized error handling
  
- 📨 **Topic System**
  - Simple subscribe/unsubscribe
  - Notification support
  - Custom message hooks

## Installation

```bash
bun add @helios-starling/starling
```

## Quick Start

```javascript
import { Starling } from '@helios-starling/starling';

// Create client
const starling = new Starling('ws://localhost:3000', {
  reconnectDelay: 1000,
  maxReconnectAttempts: 5
});

// Connect
await starling.connect();

// Send a request
try {
  const response = await starling.request('users:get', { id: 123 });
  console.log('User:', response);
} catch (error) {
  console.error('Error:', error);
}

// Listen to a topic
starling.on('notifications', (data) => {
  console.log('Notification received:', data);
});
```

## Local Methods

```javascript
// Register a method
starling.method('echo', async (context) => {
  // Access request data
  const { payload } = context;
  
  // Send response
  context.success(payload);
  
  // Or send error
  context.error('ERROR_CODE', 'Error message');
});
```

## Event Handling

```javascript
// Connection events
starling.events.on('starling:open', () => {
  console.log('Connected!');
});

starling.events.on('starling:close', () => {
  console.log('Disconnected!');
});

starling.events.on('starling:error', ({ error }) => {
  console.error('Connection error:', error);
});

// Message events
starling.events.on('message:request', ({ message }) => {
  console.log('Received request:', message);
});

starling.events.on('message:response', ({ message }) => {
  console.log('Received response:', message);
});
```

## Custom Message Hooks

```javascript
// Non-standard JSON messages
starling.onjson((message) => {
  console.log('Raw JSON message:', message);
});

// Text messages
starling.ontext((message) => {
  console.log('Raw text message:', message);
});

// Binary messages
starling.onbinary((message) => {
  console.log('Binary message:', message);
});

// Notifications
starling.onnotification((notification) => {
  console.log('Custom notification:', notification);
});
```

## Configuration Options

```javascript
const starling = new Starling(url, {
  // Reconnection
  reconnectDelay: 1000,        // Initial delay
  maxReconnectAttempts: 5,     // Max attempts
  reconnect: true,             // Enable/disable
  
  // Requests
  timeout: 30000,              // Default timeout
});
```

## State Management

Starling supports state persistence between reconnections using JWT tokens:

```javascript
// Request a state token from server
const token = await starling.sync();

// Token will be automatically used during reconnection
await starling.connect();
```

## Compatibility

- ✅ Modern browsers
- ✅ Node.js
- ✅ Bun
- ✅ Deno

## License

MIT

## Author

[Killian Devcroix](https://github.com/helios-starling)