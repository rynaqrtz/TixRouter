import type { ProviderMetadata } from "./types.js";

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export const NVIDIA_PROVIDER: ProviderMetadata = {
    id: "nvidia",
    name: "NVIDIA NIM",
    category: "api_key",
    protocol: "openai",
    alias: "nvidia",
    base_url: NVIDIA_BASE_URL,
    web_url: "https://build.nvidia.com",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "NVIDIA API key missing"
};
