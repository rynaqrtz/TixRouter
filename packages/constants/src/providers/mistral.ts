import type { ProviderMetadata } from "./types.js";

export const MISTRAL_BASE_URL = "https://api.mistral.ai/v1";

export const MISTRAL_PROVIDER: ProviderMetadata = {
    id: "mistral",
    name: "Mistral AI",
    category: "api_key",
    protocol: "openai",
    alias: "mistral",
    base_url: MISTRAL_BASE_URL,
    web_url: "https://mistral.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Mistral API key missing"
};
