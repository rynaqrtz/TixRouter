import type { ProviderMetadata } from "./types.js";

export const SAMBANOVA_BASE_URL = "https://api.sambanova.ai/v1";

export const SAMBANOVA_PROVIDER: ProviderMetadata = {
    id: "sambanova",
    name: "SambaNova",
    category: "api_key",
    protocol: "openai",
    alias: "samba",
    base_url: SAMBANOVA_BASE_URL,
    web_url: "https://sambanova.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "SambaNova API key missing"
};
