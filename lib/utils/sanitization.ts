/**
 * Input sanitization utilities for chat messages
 * Provides protection against prompt injection and malicious input
 */

import {
  MAX_MESSAGE_LENGTH,
  MAX_TOTAL_MESSAGES_LENGTH,
} from "@/lib/constants/ai-config";

/**
 * Common prompt injection patterns to detect and warn about
 * These patterns are used for logging/monitoring, not blocking
 */
const PROMPT_INJECTION_PATTERNS = [
  // System prompt override attempts
  /\b(ignore|forget|disregard)\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /\b(new\s+)?system\s*:?\s*(prompt|message|instruction)/i,
  /\byou\s+are\s+now\s+(a|an)\s+/i,
  /\bact\s+as\s+(if\s+)?you\s+(are|were)\s+/i,
  /\bpretend\s+(that\s+)?you\s+(are|were|have)\s+/i,

  // Role manipulation
  /\bswitch\s+(to\s+)?(developer|admin|system|root)\s+mode/i,
  /\b(enter|enable)\s+(developer|admin|jailbreak|dan)\s+mode/i,
  /\[system\]|\[admin\]|\[developer\]/i,

  // Delimiter injection
  /```\s*(system|assistant|user)\s*\n/i,
  /<\|?(system|assistant|user|im_start|im_end)\|?>/i,

  // Instruction override attempts
  /\boverride\s+(all\s+)?(safety|content|ethical)\s+(guidelines?|filters?|restrictions?)/i,
  /\bbypass\s+(all\s+)?(restrictions?|limitations?|filters?)/i,
];

/**
 * Result of sanitization operation
 */
export interface SanitizationResult {
  /** Sanitized content */
  content: string;
  /** Whether the content was modified during sanitization */
  wasModified: boolean;
  /** Whether potential prompt injection patterns were detected */
  hasInjectionPatterns: boolean;
  /** Original length before any truncation */
  originalLength: number;
  /** Whether the content was truncated */
  wasTruncated: boolean;
}

/**
 * Sanitize a single message content string
 *
 * @param content - The message content to sanitize
 * @param maxLength - Maximum allowed length (defaults to MAX_MESSAGE_LENGTH)
 * @returns SanitizationResult with sanitized content and metadata
 */
export function sanitizeMessageContent(
  content: string,
  maxLength: number = MAX_MESSAGE_LENGTH
): SanitizationResult {
  const originalLength = content.length;
  let sanitized = content;
  let wasModified = false;

  // 1. Normalize unicode and remove null bytes / control characters (except newlines/tabs)
  const beforeNormalize = sanitized;
  sanitized = sanitized
    .normalize("NFC")
    .replace(/\x00/g, "") // Remove null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""); // Remove control chars except \t \n \r

  if (sanitized !== beforeNormalize) {
    wasModified = true;
  }

  // 2. Trim excessive whitespace (preserve single spaces and newlines)
  const beforeWhitespace = sanitized;
  sanitized = sanitized
    .replace(/[ \t]+/g, " ") // Collapse horizontal whitespace
    .replace(/\n{4,}/g, "\n\n\n") // Limit consecutive newlines to 3
    .trim();

  if (sanitized !== beforeWhitespace) {
    wasModified = true;
  }

  // 3. Check for prompt injection patterns (for logging, not blocking)
  const hasInjectionPatterns = PROMPT_INJECTION_PATTERNS.some((pattern) =>
    pattern.test(sanitized)
  );

  // 4. Truncate if too long
  let wasTruncated = false;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
    wasTruncated = true;
    wasModified = true;
  }

  return {
    content: sanitized,
    wasModified,
    hasInjectionPatterns,
    originalLength,
    wasTruncated,
  };
}

/**
 * Validate and sanitize an array of messages
 *
 * @param messages - Array of messages with content/parts
 * @returns Object with sanitized messages and validation metadata
 */
export function sanitizeMessages<
  T extends { content?: string; parts?: Array<{ type: string; text?: string }> }
>(
  messages: T[]
): {
  messages: T[];
  totalLength: number;
  hasInjectionPatterns: boolean;
  wasTruncated: boolean;
  wasModified: boolean;
} {
  let totalLength = 0;
  let hasInjectionPatterns = false;
  let wasTruncated = false;
  let wasModified = false;

  const sanitizedMessages = messages.map((msg) => {
    const sanitizedMsg = { ...msg };

    // Sanitize content field
    if (typeof sanitizedMsg.content === "string" && sanitizedMsg.content) {
      const result = sanitizeMessageContent(sanitizedMsg.content);
      sanitizedMsg.content = result.content;
      totalLength += result.content.length;

      if (result.hasInjectionPatterns) hasInjectionPatterns = true;
      if (result.wasTruncated) wasTruncated = true;
      if (result.wasModified) wasModified = true;
    }

    // Sanitize parts field
    if (Array.isArray(sanitizedMsg.parts)) {
      sanitizedMsg.parts = sanitizedMsg.parts.map((part) => {
        if (part.type === "text" && typeof part.text === "string") {
          const result = sanitizeMessageContent(part.text);
          totalLength += result.content.length;

          if (result.hasInjectionPatterns) hasInjectionPatterns = true;
          if (result.wasTruncated) wasTruncated = true;
          if (result.wasModified) wasModified = true;

          return { ...part, text: result.content };
        }
        return part;
      });
    }

    return sanitizedMsg;
  });

  return {
    messages: sanitizedMessages,
    totalLength,
    hasInjectionPatterns,
    wasTruncated,
    wasModified,
  };
}

/**
 * Check if total message length exceeds the maximum allowed
 *
 * @param totalLength - Total length of all messages
 * @returns Whether the total length is valid
 */
export function isValidTotalLength(totalLength: number): boolean {
  return totalLength <= MAX_TOTAL_MESSAGES_LENGTH;
}

/**
 * Log sanitization warnings for monitoring
 * In production, this could be sent to a monitoring service
 */
export function logSanitizationWarning(
  context: {
    hasInjectionPatterns: boolean;
    wasTruncated: boolean;
    totalLength: number;
    userId?: string | null;
  },
  level: "warn" | "info" = "warn"
): void {
  if (context.hasInjectionPatterns) {
    console[level](
      "[Sanitization] Potential prompt injection pattern detected",
      {
        userId: context.userId ?? "anonymous",
        totalLength: context.totalLength,
      }
    );
  }

  if (context.wasTruncated) {
    console[level]("[Sanitization] Message content was truncated", {
      userId: context.userId ?? "anonymous",
      totalLength: context.totalLength,
    });
  }
}
