import type { ProviderMetadata } from "./types.js";

export const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";

export const FIREWORKS_PROVIDER: ProviderMetadata = {
    id: "fireworks",
    name: "Fireworks AI",
    category: "api_key",
    protocol: "openai",
    alias: "fireworks",
    base_url: FIREWORKS_BASE_URL,
    web_url: "https://fireworks.ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Fireworks API key missing"
};
