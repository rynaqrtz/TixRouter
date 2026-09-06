import type { ProviderMetadata } from "./types.js";

export const CHUTES_PROVIDER: ProviderMetadata = {
    id: "chutes",
    name: "Chutes",
    category: "api_key",
    protocol: "openai",
    alias: "chutes",
    base_url: "https://api.chutes.ai/v1",
    web_url: "https://chutes.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Chutes API key missing"
};
