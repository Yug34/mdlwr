"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
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

  // Sync conversationId with URL params
  useEffect(() => {
    setConversationId(urlConversationId);
  }, [urlConversationId]);

  const { messages, sendMessage, status, setMessages } = useChat({
    api: "/api/chat",
    body: () => ({
      conversationId: conversationId || undefined,
    }),
    initialMessages: [],
    onResponse: (response) => {
      // Capture conversationId from response headers and update URL if needed
      const newConversationId = response.headers.get("X-Conversation-Id");
      if (newConversationId && !conversationId) {
        // Update state and URL with the new conversationId
        setConversationId(newConversationId);
        router.replace(`/?conversationId=${newConversationId}`);
      }
    },
  });

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
              const formattedMessages = data.messages.map((msg: any) => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                parts: msg.parts,
              }));
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

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  return (
    <>
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Type a message below to begin"
            />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.role === "assistant" ? (
                    <MessageResponse>
                      {message.parts
                        ?.filter((part) => part.type === "text")
                        .map((part) => part.text)
                        .join("")}
                    </MessageResponse>
                  ) : (
                    message.parts?.map(
                      (part) => part.type === "text" && part.text
                    )
                  )}
                </MessageContent>
              </Message>
            ))
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
    </>
  );
}
