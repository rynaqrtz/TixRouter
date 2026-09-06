import type { ProviderMetadata } from "./types.js";

export const QIANFAN_PROVIDER: ProviderMetadata = {
    id: "qianfan",
    name: "Qianfan (Baidu)",
    category: "api_key",
    protocol: "openai",
    alias: "qianfan",
    base_url: "https://qianfan.baidubce.com/v2",
    web_url: "https://cloud.baidu.com/qianfan",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Qianfan API key missing"
};
