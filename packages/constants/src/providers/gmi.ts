import type { ProviderMetadata } from "./types.js";

export const GMI_PROVIDER: ProviderMetadata = {
    id: "gmi",
    name: "GMI Cloud",
    category: "api_key",
    protocol: "openai",
    alias: "gmi",
    base_url: "https://api.gmi.cloud/v1",
    web_url: "https://gmi.cloud",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "GMI Cloud API key missing"
};
