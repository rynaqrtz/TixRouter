import type { ProviderMetadata } from "./types.js";

export const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";

export const CEREBRAS_PROVIDER: ProviderMetadata = {
    id: "cerebras",
    name: "Cerebras",
    category: "api_key",
    protocol: "openai",
    alias: "cerebras",
    base_url: CEREBRAS_BASE_URL,
    web_url: "https://cerebras.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Cerebras API key missing"
};
