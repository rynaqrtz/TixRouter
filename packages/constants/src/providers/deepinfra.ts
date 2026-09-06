import type { ProviderMetadata } from "./types.js";

export const DEEPINFRA_PROVIDER: ProviderMetadata = {
    id: "deepinfra",
    name: "DeepInfra",
    category: "api_key",
    protocol: "openai",
    alias: "deepinfra",
    base_url: "https://api.deepinfra.com/v1/openai",
    web_url: "https://deepinfra.com",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "DeepInfra API key missing"
};
