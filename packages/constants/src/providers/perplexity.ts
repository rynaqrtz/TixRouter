import type { ProviderMetadata } from "./types.js";

export const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";

export const PERPLEXITY_PROVIDER: ProviderMetadata = {
    id: "perplexity",
    name: "Perplexity",
    category: "api_key",
    protocol: "openai",
    alias: "pplx",
    base_url: PERPLEXITY_BASE_URL,
    web_url: "https://perplexity.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Perplexity API key missing"
};
