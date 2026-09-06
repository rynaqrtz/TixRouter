import type { ProviderMetadata } from "./types.js";

export const LLAMACPP_PROVIDER: ProviderMetadata = {
    id: "llamacpp",
    name: "llama.cpp",
    category: "self_hosted",
    protocol: "openai",
    alias: "llamacpp",
    base_url: "http://127.0.0.1:8080/v1",
    web_url: "https://github.com/ggml-org/llama.cpp",
    requires_api_key: false,
    supports_custom_url: true,
    status_message: "llama.cpp not running"
};
