import { GOROUTER_BASE_URL } from "@tixrouter/constants";
import { OpenAIExecutor, type OpenAIExecutorOptions } from "./openai.js";

export interface GoRouterExecutorOptions extends OpenAIExecutorOptions {}

export class GoRouterExecutor extends OpenAIExecutor {
    constructor(options: GoRouterExecutorOptions = {}) {
        super({
            id: options.id ?? "gorouter",
            name: options.name ?? "GoRouter",
            baseUrl: options.baseUrl ?? GOROUTER_BASE_URL,
            apiKey: options.apiKey,
            accessToken: options.accessToken
        });
    }
}
