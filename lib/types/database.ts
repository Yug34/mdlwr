/**
 * Database entity types matching the Supabase schema
 */

export type MessageRole = "user" | "assistant" | "system";

export interface MessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface User {
  id: string;
  kinde_user_id: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  parts: MessagePart[] | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface UserProfile {
  id: string;
  user_id: string;
  profile_data: {
    profile_text: string;
    [key: string]: unknown;
  };
  last_updated: string;
  created_at: string;
}
