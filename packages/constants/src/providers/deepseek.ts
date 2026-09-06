import type { ProviderMetadata } from "./types.js";

export const DEEPSEEK_BASE_URL = "https://chat.deepseek.com";

export const DEEPSEEK_PROVIDER: ProviderMetadata = {
    id: "deepseek",
    name: "DeepSeek",
    category: "api_key",
    protocol: "openai",
    alias: "ds",
    base_url: DEEPSEEK_BASE_URL,
    web_url: "https://deepseek.com",
    requires_api_key: true,
    supports_custom_url: false,
    status_message: "DeepSeek token missing"
};
