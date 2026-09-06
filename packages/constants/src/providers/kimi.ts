import type { ProviderMetadata } from "./types.js";

export const KIMI_PROVIDER: ProviderMetadata = {
    id: "kimi",
    name: "Kimi (Moonshot AI)",
    category: "api_key",
    protocol: "openai",
    alias: "kimi",
    base_url: "https://api.moonshot.cn/v1",
    web_url: "https://platform.moonshot.cn",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Kimi API key missing"
};
