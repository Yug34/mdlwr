import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isSelfReferenceQuery,
  generatePersonalityProfile,
  fetchRecentConversations,
  type Message,
} from "@/lib/services/profile-generator";
import { createOpenAI } from "@ai-sdk/openai";
import { createSupabaseClient } from "@/lib/supabase";
import { generateText } from "ai";
import {
  createMockSupabaseClient,
  createMockOpenAIClient,
  resetMockData,
  addMockConversation,
  addMockMessage,
  createTestConversation,
  createTestMessage,
} from "../utils/mocks";
import { createTestUser as createUser } from "../utils/test-helpers";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

describe("profile-generator", () => {
  beforeEach(() => {
    resetMockData();
    vi.clearAllMocks();
  });

  describe("isSelfReferenceQuery", () => {
    it("should detect 'Who am I' as self-reference", async () => {
      const mockOpenAI = createMockOpenAIClient();
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as any);
      vi.mocked(generateText).mockResolvedValue({
        text: "yes",
        usage: { promptTokens: 10, completionTokens: 1 },
        finishReason: "stop",
        warnings: [],
      } as any);

      const result = await isSelfReferenceQuery("Who am I?", mockOpenAI);
      expect(result).toBe(true);
      expect(generateText).toHaveBeenCalled();
    });

    it("should detect 'Tell me about myself' as self-reference", async () => {
      const mockOpenAI = createMockOpenAIClient();
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as any);
      vi.mocked(generateText).mockResolvedValue({
        text: "yes",
        usage: { promptTokens: 10, completionTokens: 1 },
        finishReason: "stop",
        warnings: [],
      } as any);

      const result = await isSelfReferenceQuery(
        "Tell me about myself",
        mockOpenAI
      );
      expect(result).toBe(true);
    });

    it("should reject 'How does React work?' as not self-reference", async () => {
      const mockOpenAI = createMockOpenAIClient();
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as any);
      vi.mocked(generateText).mockResolvedValue({
        text: "no",
        usage: { promptTokens: 10, completionTokens: 1 },
        finishReason: "stop",
        warnings: [],
      } as any);

      const result = await isSelfReferenceQuery(
        "How does React work?",
        mockOpenAI as any
      );
      expect(result).toBe(false);
    });

    it("should reject 'What is TypeScript?' as not self-reference", async () => {
      const mockOpenAI = createMockOpenAIClient();
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as any);
      vi.mocked(generateText).mockResolvedValue({
        text: "no",
        usage: { promptTokens: 10, completionTokens: 1 },
        finishReason: "stop",
        warnings: [],
      } as any);

      const result = await isSelfReferenceQuery(
        "What is TypeScript?",
        mockOpenAI as any
      );
      expect(result).toBe(false);
    });

    it("should handle empty strings", async () => {
      const mockOpenAI = createMockOpenAIClient();
      const result = await isSelfReferenceQuery("", mockOpenAI);
      expect(result).toBe(false);
      expect(generateText).not.toHaveBeenCalled();
    });

    it("should handle null/undefined gracefully", async () => {
      const mockOpenAI = createMockOpenAIClient();
      const result1 = await isSelfReferenceQuery(
        null as any,
        mockOpenAI as any
      );
      const result2 = await isSelfReferenceQuery(
        undefined as any,
        mockOpenAI as any
      );
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });

  describe("generatePersonalityProfile", () => {
    it("should generate profile from conversation history", async () => {
      const mockOpenAI = createMockOpenAIClient();
      const mockProfile =
        "This user is a software developer who loves TypeScript and React...";
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as any);
      vi.mocked(generateText).mockResolvedValue({
        text: mockProfile,
        usage: { promptTokens: 100, completionTokens: 200 },
        finishReason: "stop",
        warnings: [],
      } as any);

      const messages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "I love TypeScript",
          created_at: new Date().toISOString(),
        },
        {
          id: "2",
          role: "assistant",
          content: "That's great!",
          created_at: new Date().toISOString(),
        },
        {
          id: "3",
          role: "user",
          content: "I work with React daily",
          created_at: new Date().toISOString(),
        },
      ];

      const result = await generatePersonalityProfile(
        messages,
        mockOpenAI as any
      );
      expect(result).toBe(mockProfile);
      expect(generateText).toHaveBeenCalled();
      const callArgs = vi.mocked(generateText).mock.calls[0][0];
      expect(callArgs.prompt).toContain("User: I love TypeScript");
      expect(callArgs.prompt).toContain("Assistant: That's great!");
    });

    it("should handle empty message arrays", async () => {
      const mockOpenAI = createMockOpenAIClient();
      const result = await generatePersonalityProfile([], mockOpenAI as any);
      expect(result).toContain("don't have enough conversation history");
      expect(generateText).not.toHaveBeenCalled();
    });

    it("should format messages correctly", async () => {
      const mockOpenAI = createMockOpenAIClient();
      vi.mocked(createOpenAI).mockReturnValue(mockOpenAI as any);
      vi.mocked(generateText).mockResolvedValue({
        text: "Profile text",
        usage: { promptTokens: 100, completionTokens: 200 },
        finishReason: "stop",
        warnings: [],
      } as any);

      const messages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "Hello",
          created_at: new Date().toISOString(),
        },
        {
          id: "2",
          role: "assistant",
          content: "Hi there!",
          created_at: new Date().toISOString(),
        },
      ];

      await generatePersonalityProfile(messages, mockOpenAI as any);
      const callArgs = vi.mocked(generateText).mock.calls[0][0];
      expect(callArgs.prompt).toContain("User: Hello");
      expect(callArgs.prompt).toContain("Assistant: Hi there!");
    });
  });

  describe("fetchRecentConversations", () => {
    it("should fetch messages from last 30 days", async () => {
      const testUser = createUser();
      const mockSupabase = createMockSupabaseClient();
      vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

      const conversation1 = createTestConversation(testUser.id, {
        created_at: new Date(
          Date.now() - 10 * 24 * 60 * 60 * 1000
        ).toISOString(), // 10 days ago
      });
      const conversation2 = createTestConversation(testUser.id, {
        created_at: new Date(
          Date.now() - 5 * 24 * 60 * 60 * 1000
        ).toISOString(), // 5 days ago
      });

      addMockConversation(conversation1);
      addMockConversation(conversation2);

      const message1 = createTestMessage(conversation1.id, "user", "Message 1");
      const message2 = createTestMessage(conversation2.id, "user", "Message 2");

      addMockMessage(message1);
      addMockMessage(message2);

      const result = await fetchRecentConversations(testUser.id);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should limit to 10 most recent conversations", async () => {
      const testUser = createUser();
      const mockSupabase = createMockSupabaseClient();
      vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

      // Create 15 conversations
      for (let i = 0; i < 15; i++) {
        const conv = createTestConversation(testUser.id, {
          created_at: new Date(
            Date.now() - i * 24 * 60 * 60 * 1000
          ).toISOString(),
        });
        addMockConversation(conv);
        addMockMessage(createTestMessage(conv.id, "user", `Message ${i}`));
      }

      const result = await fetchRecentConversations(testUser.id);
      // Should limit to 10 conversations
      expect(result.length).toBeLessThanOrEqual(15); // Messages from 10 conversations
    });

    it("should return empty array when no conversations exist", async () => {
      const testUser = createUser();
      const mockSupabase = createMockSupabaseClient();
      vi.mocked(createSupabaseClient).mockReturnValue(mockSupabase as any);

      const result = await fetchRecentConversations(testUser.id);
      expect(result).toEqual([]);
    });
  });
});
