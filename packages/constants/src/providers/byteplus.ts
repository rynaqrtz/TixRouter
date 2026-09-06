import type { ProviderMetadata } from "./types.js";

export const BYTEPLUS_PROVIDER: ProviderMetadata = {
    id: "byteplus",
    name: "BytePlus",
    category: "api_key",
    protocol: "openai",
    alias: "byteplus",
    base_url: "https://ark.ap-southeast.bytepluses.com/api/v3",
    web_url: "https://www.byteplus.com/en/ark",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "BytePlus API key missing"
};
