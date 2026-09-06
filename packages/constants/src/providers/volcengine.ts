import type { ProviderMetadata } from "./types.js";

export const VOLCENGINE_PROVIDER: ProviderMetadata = {
    id: "volcengine",
    name: "Volcano Engine (Doubao)",
    category: "api_key",
    protocol: "openai",
    alias: "volcengine",
    base_url: "https://ark.cn-beijing.volces.com/api/v3",
    web_url: "https://www.volcengine.com/product/ark",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Volcano Engine API key missing"
};
