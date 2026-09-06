import type { ProviderMetadata } from "./types.js";

export const DEEPSEEK_FREE_BASE_URL = "https://chat.deepseek.com";

export const DEEPSEEK_FREE_PROVIDER: ProviderMetadata = {
    id: "deepseek-free",
    name: "RYNArouter Free",
    category: "free_tier",
    protocol: "openai",
    alias: "dsfree",
    base_url: DEEPSEEK_FREE_BASE_URL,
    web_url: "https://deepseek.com",
    requires_api_key: true,
    supports_custom_url: false,
    status_message: "RYNArouter Free credentials missing (email:password, or email:pass;email:pass for a pool)"
};
