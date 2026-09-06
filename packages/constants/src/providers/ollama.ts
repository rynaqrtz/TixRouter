import type { ProviderMetadata } from "./types.js";

export const OLLAMA_PROVIDER: ProviderMetadata = {
    id: "ollama",
    name: "Ollama",
    category: "self_hosted",
    protocol: "openai",
    alias: "ollama",
    base_url: "http://localhost:11434/v1",
    web_url: "https://ollama.com",
    requires_api_key: false,
    supports_custom_url: true,
    status_message: "Ollama not running"
};
