import type { ProviderMetadata } from "./types.js";

export const TENCENT_TOKENHUB_PROVIDER: ProviderMetadata = {
    id: "tencent-tokenhub",
    name: "Tencent TokenHub",
    category: "api_key",
    protocol: "openai",
    alias: "tokenhub",
    base_url: "https://api.lkeap.tencentcloud.com/v1",
    web_url: "https://cloud.tencent.com/product/tokenhub",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Tencent TokenHub API key missing"
};
