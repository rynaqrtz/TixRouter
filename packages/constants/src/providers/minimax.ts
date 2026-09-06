import type { ProviderMetadata } from "./types.js";

export const MINIMAX_PROVIDER: ProviderMetadata = {
    id: "minimax",
    name: "MiniMax",
    category: "api_key",
    protocol: "openai",
    alias: "minimax",
    base_url: "https://api.minimax.chat/v1",
    web_url: "https://www.minimaxi.com",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "MiniMax API key missing"
};
