"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getRandomSuggestions } from "@/lib/utils";

export function ChatClient() {
  const [input, setInput] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlConversationId = searchParams.get("conversationId");
  const [conversationId, setConversationId] = useState<string | null>(
    urlConversationId
  );
  const [randomSuggestions, setRandomSuggestions] = useState<string[]>([]);
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false);
  const [showUnauthenticatedDialog, setShowUnauthenticatedDialog] =
    useState(false);
  const [hasShownDialog, setHasShownDialog] = useState(false);

  // Use a ref to always have the latest conversationId in the body function
  const conversationIdRef = useRef<string | null>(conversationId);

  // Update ref whenever conversationId changes
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Sync conversationId with URL params
  useEffect(() => {
    setConversationId(urlConversationId);
    // Also update ref immediately when URL changes
    conversationIdRef.current = urlConversationId;
  }, [urlConversationId]);

  // Custom fetch to intercept and modify the request body
  // Note: We don't include searchParams in dependencies to avoid recreating the function
  // Instead, we'll read from window.location or use a ref
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  const customFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      // Only intercept POST requests to /api/chat
      if (options.method === "POST" && url.includes("/api/chat")) {
        // Always get the latest conversationId from URL params first, then fall back to ref/state
        // Use ref to get latest searchParams without recreating the function
        const urlId = searchParamsRef.current.get("conversationId");
        const currentId = urlId || conversationIdRef.current || conversationId;

        // If there's a body, parse it, add conversationId, and stringify it back
        if (options.body) {
          try {
            let bodyStr: string;

            if (typeof options.body === "string") {
              bodyStr = options.body;
            } else {
              // For other types (ReadableStream, Blob, etc.), read as text
              bodyStr = await new Response(options.body as BodyInit).text();
            }

            const bodyObj = JSON.parse(bodyStr);
            bodyObj.conversationId = currentId || undefined;
            options.body = JSON.stringify(bodyObj);
          } catch (error) {
            console.error("Error modifying body:", error);
          }
        } else {
          // If no body, create one with conversationId
          options.body = JSON.stringify({
            conversationId: currentId || undefined,
          });
        }
      }

      // Call the original fetch
      return fetch(url, options);
    },
    [conversationId]
  );

  const {
    messages,
    sendMessage: originalSendMessage,
    status,
    setMessages,
  } = useChat({
    api: "/api/chat",
    fetch: customFetch,
    initialMessages: [],
    onResponse: (response: Response) => {
      // Capture conversationId from response headers and update URL if needed
      const newConversationId = response.headers.get("X-Conversation-Id");
      if (newConversationId) {
        // Update ref immediately so next message uses the correct conversationId
        conversationIdRef.current = newConversationId;
        // Update state and URL if different
        if (newConversationId !== conversationId) {
          setConversationId(newConversationId);
          router.replace(`/?conversationId=${newConversationId}`);
          // Dispatch event to notify ConversationList to refresh
          window.dispatchEvent(
            new CustomEvent("conversationCreated", {
              detail: { conversationId: newConversationId },
            })
          );
        }
      }
    },
    onFinish: () => {
      // After streaming completes, dispatch event to refresh sidebar
      // The conversation list will retry fetching to catch the title update
      // since title is set asynchronously after messages are stored
      const currentConversationId = conversationIdRef.current;
      if (currentConversationId) {
        // Dispatch immediately - the conversation list will handle retries
        window.dispatchEvent(
          new CustomEvent("conversationUpdated", {
            detail: { conversationId: currentConversationId },
          })
        );
      }
    },
  } as Parameters<typeof useChat>[0]);

  // Wrap sendMessage to create conversationId before first message if needed
  const sendMessage = useCallback(
    async (message: Parameters<typeof originalSendMessage>[0]) => {
      // If no conversationId exists and this is the first message, create one
      const currentId =
        urlConversationId || conversationIdRef.current || conversationId;
      if (!currentId && messages.length === 0) {
        let newConversationId: string | null = null;

        try {
          // Try to create a persisted conversation for authenticated users
          const response = await fetch("/api/conversations", {
            method: "POST",
          });
          if (response.ok) {
            const data = await response.json();
            newConversationId = data.conversationId;
            // Dispatch event to notify ConversationList to refresh
            window.dispatchEvent(
              new CustomEvent("conversationCreated", {
                detail: { conversationId: newConversationId },
              })
            );
          } else if (response.status === 401 || response.status === 403) {
            // Unauthenticated user - generate session-only conversation ID
            newConversationId = crypto.randomUUID();
            // Show dialog on first message if we haven't shown it yet
            if (!hasShownDialog) {
              setShowUnauthenticatedDialog(true);
              setHasShownDialog(true);
            }
          }
        } catch (error) {
          console.error("Error creating conversation:", error);
          // For unauthenticated users or other errors, generate session-only ID
          newConversationId = crypto.randomUUID();
          // Show dialog on first message if we haven't shown it yet
          // (This handles network errors that might also indicate unauthenticated state)
          if (!hasShownDialog && messages.length === 0) {
            setShowUnauthenticatedDialog(true);
            setHasShownDialog(true);
          }
        }

        // Update ref, state, and URL with the conversation ID (persisted or session-only)
        if (newConversationId) {
          conversationIdRef.current = newConversationId;
          setConversationId(newConversationId);
          router.replace(`/?conversationId=${newConversationId}`);
        }
      }

      // Call original sendMessage - useChat handles the type checking
      return originalSendMessage(
        message as Parameters<typeof originalSendMessage>[0]
      );
    },
    [
      originalSendMessage,
      urlConversationId,
      conversationId,
      messages.length,
      router,
    ]
  );

  useEffect(() => {
    // Generate random suggestions only on client side to avoid hydration mismatch
    setRandomSuggestions(getRandomSuggestions());
  }, []);

  useEffect(() => {
    // Reset loaded flag when conversationId changes
    setInitialMessagesLoaded(false);
    // Reset messages when conversationId is cleared (new chat)
    if (!conversationId) {
      setMessages([]);
    }
  }, [conversationId, setMessages]);

  useEffect(() => {
    // Load messages when conversationId changes
    async function loadMessages() {
      if (conversationId && !initialMessagesLoaded) {
        try {
          const response = await fetch(
            `/api/conversations/${conversationId}/messages`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.messages && data.messages.length > 0) {
              // Transform messages to the format expected by useChat
              const formattedMessages = data.messages.map(
                (msg: {
                  id: string;
                  role: string;
                  content: string;
                  parts: unknown;
                }) => ({
                  id: msg.id,
                  role: msg.role,
                  content: msg.content,
                  parts: msg.parts,
                })
              );
              setMessages(formattedMessages);
            }
          }
        } catch (error) {
          console.error("Error loading messages:", error);
        } finally {
          setInitialMessagesLoaded(true);
        }
      } else if (!conversationId) {
        // Reset messages when no conversation is selected
        setMessages([]);
        setInitialMessagesLoaded(false);
      }
    }

    loadMessages();
  }, [conversationId, initialMessagesLoaded, setMessages]);

  const isLoading = status === "streaming" || status === "submitted";

  // Check if we should show thinking indicator
  // Show when status is "submitted" (request sent but stream hasn't started)
  // This happens when the last message is an assistant message with no content yet
  // OR when the last message is a user message (assistant message not added yet)
  const lastMessage = messages[messages.length - 1];
  const lastMessageIsAssistantEmpty =
    lastMessage?.role === "assistant" &&
    (!lastMessage.parts ||
      lastMessage.parts.length === 0 ||
      !lastMessage.parts.some(
        (part) =>
          part.type === "text" && part.text && part.text.trim().length > 0
      ));
  const shouldShowThinkingAsSeparate =
    status === "submitted" && lastMessage?.role === "user";
  const shouldShowThinkingInMessage =
    status === "submitted" && lastMessageIsAssistantEmpty;

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  return (
    <>
      <Conversation>
        <ConversationContent>
          {messages.length === 0 && !shouldShowThinkingAsSeparate ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Type a message below to begin"
            />
          ) : (
            <>
              {messages.map((message, index) => {
                const isLastMessage = index === messages.length - 1;
                const shouldShowThinkingForThisMessage =
                  isLastMessage &&
                  message.role === "assistant" &&
                  shouldShowThinkingInMessage;

                return (
                  <Message key={message.id} from={message.role}>
                    <MessageContent>
                      {message.role === "assistant" ? (
                        shouldShowThinkingForThisMessage ? (
                          <Shimmer>Thinking...</Shimmer>
                        ) : (
                          <MessageResponse>
                            {message.parts
                              ?.filter((part) => part.type === "text")
                              .map((part) => part.text)
                              .join("")}
                          </MessageResponse>
                        )
                      ) : (
                        message.parts?.map(
                          (part) => part.type === "text" && part.text
                        )
                      )}
                    </MessageContent>
                  </Message>
                );
              })}
              {shouldShowThinkingAsSeparate && (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer>Thinking...</Shimmer>
                  </MessageContent>
                </Message>
              )}
            </>
          )}
        </ConversationContent>
      </Conversation>

      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          <PromptInput
            onSubmit={(message, event) => {
              event.preventDefault();
              if (message.text) {
                sendMessage({ text: message.text });
                setInput("");
              }
            }}
            className="flex gap-2 items-end"
          >
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              rows={1}
              className="flex-1"
            />
            <PromptInputSubmit className="mr-3" disabled={isLoading} />
          </PromptInput>
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {randomSuggestions.map((suggestion: string) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={isLoading}
                  className="text-xs"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={showUnauthenticatedDialog}
        onOpenChange={setShowUnauthenticatedDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conversation Not Stored</DialogTitle>
            <DialogDescription>
              This conversation will not be stored and will be inaccessible
              after this session ends. Sign in to save your conversations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowUnauthenticatedDialog(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
