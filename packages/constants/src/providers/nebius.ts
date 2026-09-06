import type { ProviderMetadata } from "./types.js";

export const NEBIUS_BASE_URL = "https://api.studio.nebius.ai/v1";

export const NEBIUS_PROVIDER: ProviderMetadata = {
    id: "nebius",
    name: "Nebius AI",
    category: "api_key",
    protocol: "openai",
    alias: "nebius",
    base_url: NEBIUS_BASE_URL,
    web_url: "https://nebius.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Nebius API key missing"
};
