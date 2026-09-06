import type { ProviderMetadata } from "./types.js";

export const OLLAMA_CLOUD_PROVIDER: ProviderMetadata = {
    id: "ollama-cloud",
    name: "Ollama Cloud",
    category: "api_key",
    protocol: "openai",
    alias: "oc",
    base_url: "https://api.ollama.com/v1",
    web_url: "https://ollama.com",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Ollama Cloud API key missing"
};
