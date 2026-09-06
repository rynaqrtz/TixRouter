import type { ProviderMetadata } from "./types.js";

export const LMSTUDIO_PROVIDER: ProviderMetadata = {
    id: "lmstudio",
    name: "LM Studio",
    category: "self_hosted",
    protocol: "openai",
    alias: "lmstudio",
    base_url: "http://localhost:1234/v1",
    web_url: "https://lmstudio.ai",
    requires_api_key: false,
    supports_custom_url: true,
    status_message: "LM Studio not running"
};
