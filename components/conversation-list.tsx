"use client";

import { useEffect, useState, useCallback } from "react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { MessageSquare, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { capitalizeFirstLetter } from "@/lib/utils";

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export function ConversationList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentConversationId = searchParams.get("conversationId");

  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/conversations");
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      } else {
        console.error("Failed to fetch conversations");
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();

    // Refresh conversations when window regains focus
    const handleFocus = () => {
      fetchConversations();
    };
    window.addEventListener("focus", handleFocus);

    // Refresh conversations when a new conversation is created
    const handleConversationCreated = () => {
      fetchConversations();
    };
    window.addEventListener("conversationCreated", handleConversationCreated);

    // Refresh conversations when a conversation is updated
    // Title is now set during conversation creation, so immediate refresh should suffice
    const handleConversationUpdated = () => {
      fetchConversations();
    };
    window.addEventListener("conversationUpdated", handleConversationUpdated);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(
        "conversationCreated",
        handleConversationCreated
      );
      window.removeEventListener(
        "conversationUpdated",
        handleConversationUpdated
      );
    };
  }, [fetchConversations]);

  const handleConversationClick = (conversationId: string) => {
    // Navigate to the conversation
    // For now, we'll just reload the page with the conversation ID
    // You can enhance this to load the conversation in the chat client
    router.push(`/?conversationId=${conversationId}`);
  };

  if (loading) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton disabled>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (conversations.length === 0) {
    return null;
  }

  return (
    <>
      {conversations.map((conversation) => {
        const isSelected = conversation.id === currentConversationId;
        return (
          <SidebarMenuItem key={conversation.id}>
            <SidebarMenuButton
              asChild
              className="cursor-pointer"
              onClick={() => handleConversationClick(conversation.id)}
              isActive={isSelected}
            >
              <button className="w-full text-left">
                <MessageSquare className="h-4 w-4" />
                {conversation.title ? (
                  <span className="truncate">
                    {capitalizeFirstLetter(conversation.title)}
                  </span>
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </>
  );
}
