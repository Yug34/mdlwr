"use client";

import { useEffect } from "react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { MessageSquare, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { capitalizeFirstLetter } from "@/lib/utils";
import { useConversationStore } from "@/stores/conversation-store";

export function ConversationList() {
  const router = useRouter();

  const {
    currentConversationId,
    setCurrentConversation,
    conversations,
    isLoading,
    hasFetched,
    fetchConversations,
  } = useConversationStore();

  useEffect(() => {
    // Initial fetch
    if (!hasFetched) {
      fetchConversations();
    }

    // Refresh conversations when window regains focus
    const handleFocus = () => {
      fetchConversations();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [hasFetched, fetchConversations]);

  const handleConversationClick = (conversationId: string) => {
    setCurrentConversation(conversationId);
    router.push(`/?conversationId=${conversationId}`);
  };

  if (isLoading && !hasFetched) {
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
