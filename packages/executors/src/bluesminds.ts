import { BLUESMINDS_BASE_URL } from "@rynarouter/constants";
import { OpenAIExecutor, type OpenAIExecutorOptions } from "./openai.js";

export interface BluesMindsExecutorOptions extends OpenAIExecutorOptions {}

export class BluesMindsExecutor extends OpenAIExecutor {
    constructor(options: BluesMindsExecutorOptions = {}) {
        super({
            id: options.id ?? "bluesminds",
            name: options.name ?? "BluesMinds",
            baseUrl: options.baseUrl ?? BLUESMINDS_BASE_URL,
            apiKey: options.apiKey,
            accessToken: options.accessToken
        });
    }
}
