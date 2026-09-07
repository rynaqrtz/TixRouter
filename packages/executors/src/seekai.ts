import { SEEKAI_BASE_URL } from "@tixrouter/constants";
import { OpenAIExecutor, type OpenAIExecutorOptions } from "./openai.js";

export interface SeekAIExecutorOptions extends OpenAIExecutorOptions {}

export class SeekAIExecutor extends OpenAIExecutor {
    constructor(options: SeekAIExecutorOptions = {}) {
        super({
            id: options.id ?? "seekai",
            name: options.name ?? "SeekAI",
            baseUrl: options.baseUrl ?? SEEKAI_BASE_URL,
            apiKey: options.apiKey,
            accessToken: options.accessToken
        });
    }
}
