import type { ProviderMetadata } from "./types.js";

export const CLOUDFLARE_BASE_URL = "https://api.cloudflare.com/client/v4/accounts";

export const CLOUDFLARE_PROVIDER: ProviderMetadata = {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    category: "api_key",
    protocol: "openai",
    alias: "cf",
    web_url: "https://developers.cloudflare.com/workers-ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Cloudflare API token missing"
};
