import type { ProviderMetadata } from "./types.js";

export const VERTEX_BASE_URL = "https://aiplatform.googleapis.com/v1/projects";

export const VERTEX_PROVIDER: ProviderMetadata = {
    id: "vertex",
    name: "Google Vertex AI",
    category: "api_key",
    protocol: "openai",
    alias: "vertex",
    web_url: "https://cloud.google.com/vertex-ai",
    requires_api_key: true,
    supports_custom_url: true,
    status_message: "Google Cloud credentials missing"
};
