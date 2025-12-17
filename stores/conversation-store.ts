import { create } from "zustand";

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface ConversationStore {
  // Current conversation
  currentConversationId: string | null;

  // Conversations cache
  conversations: Conversation[];
  isLoading: boolean;
  hasFetched: boolean;

  // Actions
  setCurrentConversation: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  setConversations: (conversations: Conversation[]) => void;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  currentConversationId: null,
  conversations: [],
  isLoading: false,
  hasFetched: false,

  setCurrentConversation: (id) => {
    set({ currentConversationId: id });
  },

  fetchConversations: async () => {
    // Skip if already loading
    if (get().isLoading) return;

    set({ isLoading: true });
    try {
      const response = await fetch("/api/conversations");
      if (response.ok) {
        const data = await response.json();
        set({
          conversations: data.conversations || [],
          hasFetched: true,
        });
      } else {
        console.error("Failed to fetch conversations");
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  addConversation: (conversation) => {
    set((state) => ({
      // Add to the beginning (most recent first)
      conversations: [conversation, ...state.conversations],
    }));
  },

  updateConversation: (id, updates) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === id ? { ...conv, ...updates } : conv
      ),
    }));
  },

  setConversations: (conversations) => {
    set({ conversations, hasFetched: true });
  },
}));
