import type { ProviderMetadata } from "./types.js";

export const TOGETHER_BASE_URL = "https://api.together.xyz/v1";

export const TOGETHER_PROVIDER: ProviderMetadata = {
    id: "together",
    name: "Together AI",
    category: "api_key",
    protocol: "openai",
    alias: "together",
    base_url: TOGETHER_BASE_URL,
    web_url: "https://together.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Together API key missing"
};
