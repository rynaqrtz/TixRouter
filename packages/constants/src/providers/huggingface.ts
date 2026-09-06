import type { ProviderMetadata } from "./types.js";

export const HUGGINGFACE_BASE_URL = "https://api-inference.huggingface.co/v1";

export const HUGGINGFACE_PROVIDER: ProviderMetadata = {
    id: "huggingface",
    name: "HuggingFace",
    category: "api_key",
    protocol: "openai",
    alias: "hf",
    base_url: HUGGINGFACE_BASE_URL,
    web_url: "https://huggingface.co",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "HuggingFace API key missing"
};
