import type { ProviderMetadata } from "./types.js";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export const GROQ_PROVIDER: ProviderMetadata = {
    id: "groq",
    name: "Groq",
    category: "api_key",
    protocol: "openai",
    alias: "groq",
    base_url: GROQ_BASE_URL,
    web_url: "https://groq.com",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Groq API key missing"
};
