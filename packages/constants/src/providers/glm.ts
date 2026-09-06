import type { ProviderMetadata } from "./types.js";

export const GLM_PROVIDER: ProviderMetadata = {
    id: "glm",
    name: "GLM (Zhipu AI)",
    category: "api_key",
    protocol: "openai",
    alias: "glm",
    base_url: "https://open.bigmodel.cn/api/paas/v4",
    web_url: "https://open.bigmodel.cn",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "GLM API key missing"
};
