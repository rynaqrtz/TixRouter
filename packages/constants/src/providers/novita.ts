import type { ProviderMetadata } from "./types.js";

export const NOVITAAI_PROVIDER: ProviderMetadata = {
    id: "novita",
    name: "NovitaAI",
    category: "api_key",
    protocol: "openai",
    alias: "novita",
    base_url: "https://api.novita.ai/v3/openai",
    web_url: "https://novita.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "NovitaAI API key missing"
};
