/**
 * AI model configuration constants
 */

/**
 * Default model for chat completions
 */
export const DEFAULT_CHAT_MODEL = "gpt-4.1";

/**
 * Model for classification tasks (cheaper, faster)
 */
export const CLASSIFICATION_MODEL = "gpt-4o-mini";

/**
 * Maximum tokens for personality profile generation
 */
export const PROFILE_GENERATION_MAX_TOKENS = 1000;

/**
 * Maximum length for a single message content (in characters)
 * Approximately 32K characters ~ 8K tokens for GPT-4
 */
export const MAX_MESSAGE_LENGTH = 32000;

/**
 * Maximum total length for all messages combined (in characters)
 * This helps prevent abuse and excessive API costs
 */
export const MAX_TOTAL_MESSAGES_LENGTH = 128000;
