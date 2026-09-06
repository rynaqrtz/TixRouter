import type { ProviderMetadata } from "./types.js";

export const HYPERBOLIC_PROVIDER: ProviderMetadata = {
    id: "hyperbolic",
    name: "Hyperbolic",
    category: "api_key",
    protocol: "openai",
    alias: "hyperbolic",
    base_url: "https://api.hyperbolic.xyz/v1",
    web_url: "https://hyperbolic.xyz",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Hyperbolic API key missing"
};
