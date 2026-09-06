import type { ProviderMetadata } from "./types.js";

export const VLLM_PROVIDER: ProviderMetadata = {
    id: "vllm",
    name: "vLLM",
    category: "self_hosted",
    protocol: "openai",
    alias: "vllm",
    base_url: "http://127.0.0.1:8000/v1",
    web_url: "https://docs.vllm.ai",
    requires_api_key: false,
    supports_custom_url: true,
    status_message: "vLLM not running"
};
