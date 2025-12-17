# ChatClient Component Documentation

The `ChatClient` component (`chat-client.tsx`) is a React client component that provides a full-featured chat interface with AI streaming responses. It handles conversation management, message persistence, and real-time updates.

## Overview

This component:

- Provides a chat UI with message display and input
- Manages conversation state and URL synchronization
- Handles authenticated and unauthenticated user flows
- Supports streaming AI responses via the Vercel AI SDK
- Loads and persists messages for existing conversations

---

## Key Dependencies

```tsx
import { useChat } from "@ai-sdk/react"; // Vercel AI SDK for chat functionality
import { useSearchParams, useRouter } from "next/navigation"; // Next.js routing
```

The component uses the `useChat` hook from `@ai-sdk/react` which provides:

- `messages` - Array of chat messages
- `sendMessage` - Function to send new messages
- `status` - Current chat status ("streaming", "submitted", etc.)
- `setMessages` - Function to manually set messages

---

## State Management

### Local State

| State                       | Type             | Purpose                                        |
| --------------------------- | ---------------- | ---------------------------------------------- |
| `input`                     | `string`         | Current text in the input field                |
| `conversationId`            | `string \| null` | Current conversation ID                        |
| `randomSuggestions`         | `string[]`       | Random prompt suggestions for empty state      |
| `initialMessagesLoaded`     | `boolean`        | Flag to prevent duplicate message loading      |
| `showUnauthenticatedDialog` | `boolean`        | Controls the "not signed in" dialog visibility |
| `hasShownDialog`            | `boolean`        | Prevents showing the dialog multiple times     |

### Refs

```tsx
const conversationIdRef = useRef<string | null>(conversationId);
```

Refs are used to access the latest conversationId inside callbacks without causing re-renders or stale closures.

---

## Core Functionality

### 1. URL Synchronization

The conversation ID is synchronized with the URL query parameter `?conversationId=xxx`:

```tsx
const urlConversationId = searchParams.get("conversationId");
```

When a new conversation is created, the URL is updated:

```tsx
router.replace(`/?conversationId=${newConversationId}`);
```

### 2. Passing ConversationId in Requests

The `sendMessage` wrapper passes the `conversationId` directly in the request body:

```tsx
const sendMessage = useCallback(
  async (message: Parameters<typeof originalSendMessage>[0]) => {
    return originalSendMessage(message, {
      body: { conversationId: conversationIdRef.current || undefined },
    });
  },
  [originalSendMessage]
);
```

This allows the backend to associate messages with the correct conversation without needing a custom fetch interceptor.

### 3. Response Handling

The `onResponse` callback processes response headers from the API:

```tsx
onResponse: (response: Response) => {
  const newConversationId = response.headers.get("X-Conversation-Id");
  const isAuthenticated = response.headers.get("X-Authenticated") === "true";
  // ...
};
```

- **`X-Conversation-Id`**: Used to track the conversation (returned when a new conversation is created)
- **`X-Authenticated`**: Indicates if the user is signed in

### 4. Message Loading

When a conversation ID exists, messages are loaded from the API:

```tsx
const response = await fetch(`/api/conversations/${conversationId}/messages`);
const data = await response.json();
// Transform and set messages
setMessages(formattedMessages);
```

### 5. Event Dispatching

Custom events notify other components (like a sidebar) about conversation changes:

```tsx
// New conversation created
window.dispatchEvent(
  new CustomEvent("conversationCreated", {
    detail: { conversationId: newConversationId },
  })
);

// Conversation updated (after streaming completes)
window.dispatchEvent(
  new CustomEvent("conversationUpdated", {
    detail: { conversationId: currentConversationId },
  })
);
```

---

## Loading States

The component tracks various loading states for UI feedback:

```tsx
const isLoading = status === "streaming" || status === "submitted";
```

### Thinking Indicator Logic

| Condition                                                   | Behavior                                     |
| ----------------------------------------------------------- | -------------------------------------------- |
| `status === "submitted"` && last message is user            | Show separate "Thinking..." message          |
| `status === "submitted"` && last assistant message is empty | Show "Thinking..." inside the message bubble |

---

## UI Components

### Message Display

```tsx
<Conversation>
  <ConversationContent>
    {messages.length === 0 ? (
      <ConversationEmptyState />
    ) : (
      messages.map((message) => (
        <Message key={message.id} from={message.role}>
          <MessageContent>...</MessageContent>
        </Message>
      ))
    )}
  </ConversationContent>
</Conversation>
```

### Input Area

```tsx
<PromptInput onSubmit={...}>
  <PromptInputTextarea value={input} onChange={...} />
  <PromptInputSubmit disabled={isLoading} />
</PromptInput>
```

### Suggestion Buttons

When no messages exist, random suggestions are displayed:

```tsx
{
  messages.length === 0 && (
    <div className="flex flex-wrap gap-2">
      {randomSuggestions.map((suggestion) => (
        <Button onClick={() => handleSuggestionClick(suggestion)}>
          {suggestion}
        </Button>
      ))}
    </div>
  );
}
```

### Unauthenticated User Dialog

For users not signed in, a dialog warns that the conversation won't be saved:

```tsx
<Dialog open={showUnauthenticatedDialog}>
  <DialogContent>
    <DialogTitle>Conversation Not Stored</DialogTitle>
    <DialogDescription>
      This conversation will not be stored and will be inaccessible after this
      session ends. Sign in to save your conversations.
    </DialogDescription>
  </DialogContent>
</Dialog>
```

---

## Data Flow

```
User types message
        ↓
handleSubmit → sendMessage({ text }, { body: { conversationId } })
        ↓
POST /api/chat (with conversationId in body)
        ↓
onResponse: capture X-Conversation-Id, X-Authenticated headers
        ↓
Update URL, dispatch events
        ↓
onFinish: dispatch "conversationUpdated" event
```

---

## API Endpoints Used

| Endpoint                           | Method | Purpose                                |
| ---------------------------------- | ------ | -------------------------------------- |
| `/api/chat`                        | POST   | Send messages and receive AI responses |
| `/api/conversations/{id}/messages` | GET    | Load existing conversation messages    |

---

## Response Headers Expected

| Header              | Type              | Description                           |
| ------------------- | ----------------- | ------------------------------------- |
| `X-Conversation-Id` | string            | The conversation ID (new or existing) |
| `X-Authenticated`   | "true" \| "false" | Whether the user is authenticated     |

---

## Notes

- The component is marked with `"use client"` as it uses React hooks and browser APIs
- Random suggestions are generated client-side to avoid hydration mismatches
- The `conversationIdRef` pattern ensures the latest ID is always available in async callbacks
- Messages are reset when `conversationId` is cleared (starting a new chat)
