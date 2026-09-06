import { TABITOKEN_BASE_URL } from "@rynarouter/constants";
import { OpenAIExecutor, type OpenAIExecutorOptions } from "./openai.js";

export interface TabiTokenExecutorOptions extends OpenAIExecutorOptions {}

export class TabiTokenExecutor extends OpenAIExecutor {
    constructor(options: TabiTokenExecutorOptions = {}) {
        super({
            id: options.id ?? "tabitoken",
            name: options.name ?? "TabiToken",
            baseUrl: options.baseUrl ?? TABITOKEN_BASE_URL,
            apiKey: options.apiKey,
            accessToken: options.accessToken
        });
    }
}
