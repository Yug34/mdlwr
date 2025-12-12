"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

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
import { Navbar } from "@/components/ui/shadcn-io/navbar";
import { Button } from "@/components/ui/button";
import { getRandomSuggestions } from "@/lib/utils";

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();
  const randomSuggestions = getRandomSuggestions();

  const isLoading = status === "streaming" || status === "submitted";

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  return (
    <div className="flex flex-col w-full h-screen">
      <Navbar />
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
    </div>
  );
}
