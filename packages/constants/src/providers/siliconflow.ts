import type { ProviderMetadata } from "./types.js";

export const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";

export const SILICONFLOW_PROVIDER: ProviderMetadata = {
    id: "siliconflow",
    name: "SiliconFlow",
    category: "api_key",
    protocol: "openai",
    alias: "siliconflow",
    base_url: SILICONFLOW_BASE_URL,
    web_url: "https://siliconflow.cn",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "SiliconFlow API key missing"
};
