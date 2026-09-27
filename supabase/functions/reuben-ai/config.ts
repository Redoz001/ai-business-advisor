export const MODELS = {
  // Live Groq lineup (verified Sept 2026). The previous
  // `llama-3.3-70b-versatile` / `llama-3.1-8b-instant` names return
  // 404 model_not_found on the project's key.
  chat: "openai/gpt-oss-120b",
  fallback: "qwen/qwen3.8-27b",
  reasoning: "openai/gpt-oss-120b",
  embedding: "text-embedding-3-small",
};

export const LIMITS = {
  maxContext: 20,
  maxMemory: 10,
  maxRagChunks: 5,
  maxTokens: 2000,
};