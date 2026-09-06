import type { ProviderMetadata } from "./types.js";

export const XAI_BASE_URL = "https://api.x.ai/v1";

export const XAI_PROVIDER: ProviderMetadata = {
    id: "xai",
    name: "xAI (Grok)",
    category: "api_key",
    protocol: "openai",
    alias: "xai",
    base_url: XAI_BASE_URL,
    web_url: "https://x.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "xAI API key missing"
};
