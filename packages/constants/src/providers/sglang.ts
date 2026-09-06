import type { ProviderMetadata } from "./types.js";

export const SGLANG_PROVIDER: ProviderMetadata = {
    id: "sglang",
    name: "SGLang",
    category: "self_hosted",
    protocol: "openai",
    alias: "sglang",
    base_url: "http://127.0.0.1:30000/v1",
    web_url: "https://sgl-project.github.io",
    requires_api_key: false,
    supports_custom_url: true,
    status_message: "SGLang not running"
};
