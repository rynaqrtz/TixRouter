import type { ProviderMetadata } from "./types.js";

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

export const GEMINI_PROVIDER: ProviderMetadata = {
    id: "gemini",
    name: "Google Gemini",
    category: "api_key",
    protocol: "openai",
    alias: "gemini",
    base_url: GEMINI_BASE_URL,
    web_url: "https://aistudio.google.com",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Google API key missing"
};
