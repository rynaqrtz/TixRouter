import type { ProviderMetadata } from "./types.js";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const OPENROUTER_PROVIDER: ProviderMetadata = {
    id: "openrouter",
    name: "OpenRouter",
    category: "api_key",
    protocol: "openai",
    alias: "openrouter",
    base_url: OPENROUTER_BASE_URL,
    web_url: "https://openrouter.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "OpenRouter API key missing"
};
