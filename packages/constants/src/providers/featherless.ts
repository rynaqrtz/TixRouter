import type { ProviderMetadata } from "./types.js";

export const FEATHERLESS_PROVIDER: ProviderMetadata = {
    id: "featherless",
    name: "Featherless AI",
    category: "api_key",
    protocol: "openai",
    alias: "featherless",
    base_url: "https://api.featherless.ai/v1",
    web_url: "https://featherless.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Featherless AI API key missing"
};
