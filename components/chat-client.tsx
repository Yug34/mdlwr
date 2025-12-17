"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useConversationStore } from "@/stores/conversation-store";

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
  const {
    currentConversationId,
    setCurrentConversation,
    addConversation,
    updateConversation,
  } = useConversationStore();
  const [randomSuggestions, setRandomSuggestions] = useState<string[]>([]);
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false);
  const [showUnauthenticatedDialog, setShowUnauthenticatedDialog] =
    useState(false);
  const [hasShownDialog, setHasShownDialog] = useState(false);

  // Sync store with URL params (URL is source of truth for navigation)
  useEffect(() => {
    if (urlConversationId !== currentConversationId) {
      setCurrentConversation(urlConversationId);
    }
  }, [urlConversationId, currentConversationId, setCurrentConversation]);

  const {
    messages,
    sendMessage: originalSendMessage,
    status,
    setMessages,
  } = useChat({
    api: "/api/chat",
    initialMessages: [],
    onResponse: (response: Response) => {
      // Capture conversationId from response headers and update URL if needed
      const newConversationId = response.headers.get("X-Conversation-Id");
      const isAuthenticated =
        response.headers.get("X-Authenticated") === "true";

      // Show unauthenticated dialog for first message if not authenticated
      if (!isAuthenticated && !hasShownDialog && messages.length === 0) {
        setShowUnauthenticatedDialog(true);
        setHasShownDialog(true);
      }

      if (newConversationId) {
        const storeState = useConversationStore.getState();
        // Update store and URL if different
        if (newConversationId !== storeState.currentConversationId) {
          storeState.setCurrentConversation(newConversationId);
          router.replace(`/?conversationId=${newConversationId}`);
          // Optimistically add to conversation list (only for authenticated users)
          if (isAuthenticated) {
            storeState.addConversation({
              id: newConversationId,
              title: null, // Title will be set by the server, shows loading spinner
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      }
    },
    onFinish: async () => {
      // After streaming completes, fetch the updated conversation to get the title
      const storeState = useConversationStore.getState();
      const conversationId = storeState.currentConversationId;
      if (conversationId) {
        try {
          const response = await fetch(`/api/conversations/${conversationId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.conversation) {
              storeState.updateConversation(conversationId, {
                title: data.conversation.title,
                updated_at: data.conversation.updated_at,
              });
            }
          }
        } catch (error) {
          console.error("Error fetching conversation:", error);
        }
      }
    },
  } as Parameters<typeof useChat>[0]);

  // Wrap sendMessage to pass conversationId in the request body
  const sendMessage = useCallback(
    async (message: Parameters<typeof originalSendMessage>[0]) => {
      // Get latest conversationId from store
      const conversationId =
        useConversationStore.getState().currentConversationId;
      return originalSendMessage(message, {
        body: { conversationId: conversationId || undefined },
      });
    },
    [originalSendMessage]
  );

  useEffect(() => {
    // Generate random suggestions only on client side to avoid hydration mismatch
    setRandomSuggestions(getRandomSuggestions());
  }, []);

  useEffect(() => {
    // Reset loaded flag when conversationId changes
    setInitialMessagesLoaded(false);
    // Reset messages when conversationId is cleared (new chat)
    if (!currentConversationId) {
      setMessages([]);
    }
  }, [currentConversationId, setMessages]);

  useEffect(() => {
    // Load messages when conversationId changes
    async function loadMessages() {
      if (currentConversationId && !initialMessagesLoaded) {
        try {
          const response = await fetch(
            `/api/conversations/${currentConversationId}/messages`
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
      } else if (!currentConversationId) {
        // Reset messages when no conversation is selected
        setMessages([]);
        setInitialMessagesLoaded(false);
      }
    }

    loadMessages();
  }, [currentConversationId, initialMessagesLoaded, setMessages]);

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
