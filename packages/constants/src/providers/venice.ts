import type { ProviderMetadata } from "./types.js";

export const VENICE_PROVIDER: ProviderMetadata = {
    id: "venice",
    name: "Venice",
    category: "api_key",
    protocol: "openai",
    alias: "venice",
    base_url: "https://api.venice.ai/api/v1",
    web_url: "https://venice.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Venice API key missing"
};
