import type { ProviderMetadata } from "./types.js";

export const COHERE_BASE_URL = "https://api.cohere.com/v2";

export const COHERE_PROVIDER: ProviderMetadata = {
    id: "cohere",
    name: "Cohere",
    category: "api_key",
    protocol: "openai",
    alias: "cohere",
    base_url: COHERE_BASE_URL,
    web_url: "https://cohere.com",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Cohere API key missing"
};
