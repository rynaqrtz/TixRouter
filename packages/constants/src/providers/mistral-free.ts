import type { ProviderMetadata } from "./types.js";

export const MISTRAL_FREE_BASE_URL = "https://chat.mistral.ai";

export const MISTRAL_FREE_PROVIDER: ProviderMetadata = {
    id: "mistral-free",
    name: "Mistral Free",
    category: "free_tier",
    protocol: "openai",
    alias: "mfree",
    base_url: MISTRAL_FREE_BASE_URL,
    web_url: "https://mistral.ai",
    requires_api_key: false,
    supports_custom_url: false,
    status_message: "Anonymous Le Chat access, no key required"
};
