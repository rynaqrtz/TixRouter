import type { ProviderMetadata } from "./types.js";

export const ARCEE_PROVIDER: ProviderMetadata = {
    id: "arcee",
    name: "Arcee",
    category: "api_key",
    protocol: "openai",
    alias: "arcee",
    base_url: "https://api.arcee.ai/v2",
    web_url: "https://www.arcee.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Arcee API key missing"
};
