/**
 * AI Provider Types
 *
 * Shared type definitions for AI provider services.
 * These types define the common interface for all AI providers
 * (Ollama, OpenAI, Custom).
 */

// ==================== Provider Configuration ====================

export type AIProviderType = "ollama" | "openai" | "custom";

export interface AIProviderConfig {
  /** Unique identifier for this provider configuration */
  id: string;
  /** Type of provider (ollama, openai, custom) */
  type: AIProviderType;
  /** User-friendly display name */
  name: string;
  /** Base URL for the API endpoint */
  baseUrl: string;
  /** API key (required for openai/custom, optional for ollama) */
  apiKey?: string;
  /** Default model to use */
  model: string;
  /** Whether this is the default provider */
  isDefault?: boolean;
  /** Timestamp of last connection test */
  lastTested?: number;
  /** Result of last connection test */
  testStatus?: "success" | "error" | "pending";
  /** Error message from last failed test */
  testError?: string;
}

// ==================== Chat Interface ====================

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for response randomness (0-2) */
  temperature?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface ChatResponse {
  /** Generated text content */
  content: string;
  /** Token usage statistics (if available) */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// ==================== Provider Service Interface ====================

export interface AIProviderService {
  /** Provider configuration */
  readonly config: AIProviderConfig;

  /**
   * Send a chat completion request.
   * @param messages - Array of chat messages (system, user, assistant)
   * @param options - Optional parameters like max_tokens, temperature
   * @returns Promise resolving to the chat response
   */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  /**
   * List available models for this provider.
   * @returns Promise resolving to array of model names
   */
  listModels(): Promise<string[]>;

  /**
   * Test the connection to this provider.
   * @returns Promise resolving to true if connection successful
   */
  testConnection(): Promise<boolean>;
}

// ==================== Provider Errors ====================

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly providerType: AIProviderType,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export class AIProviderConnectionError extends AIProviderError {
  constructor(
    message: string,
    providerType: AIProviderType,
    public readonly statusCode?: number,
    details?: Record<string, unknown>,
  ) {
    super(message, providerType, details);
    this.name = "AIProviderConnectionError";
  }
}

export class AIProviderAuthError extends AIProviderError {
  constructor(message: string, providerType: AIProviderType, details?: Record<string, unknown>) {
    super(message, providerType, details);
    this.name = "AIProviderAuthError";
  }
}

export class AIProviderRateLimitError extends AIProviderError {
  constructor(
    message: string,
    providerType: AIProviderType,
    public readonly retryAfter?: number,
    details?: Record<string, unknown>,
  ) {
    super(message, providerType, details);
    this.name = "AIProviderRateLimitError";
  }
}
