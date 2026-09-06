/**
 * DeepSeek Scraper Executor
 *
 * Uses the unofficial DeepSeek web API (chat.deepseek.com) with a bearer token.
 * PoW solving via WASM, SSE stream parsing, OpenAI-compatible translation.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import type {
    AIProvider,
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ModelObject
} from "@rynarouter/types";
import { parseDataLine } from "./base.js";

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://chat.deepseek.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

const API = {
    LOGOUT: "/api/v0/users/logout",
    POW_CHALLENGE: "/api/v0/chat/create_pow_challenge",
    CREATE_SESSION: "/api/v0/chat_session/create",
    CHAT: "/api/v0/chat/completion"
} as const;

const DEEPSEEK_MODELS: ModelObject[] = [
    { id: "deepseek/deepseek-chat", object: "model", owned_by: "deepseek" },
    { id: "deepseek/deepseek-reasoner", object: "model", owned_by: "deepseek" },
    { id: "deepseek/deepseek-v3", object: "model", owned_by: "deepseek" },
    { id: "deepseek/deepseek-v4-flash", object: "model", owned_by: "deepseek" },
    { id: "deepseek/deepseek-v4-pro", object: "model", owned_by: "deepseek" }
];

// ── WASM PoW Solver ──────────────────────────────────────────────────────────

let _wasmInstance: WebAssembly.Exports | null = null;

async function loadWasm(): Promise<WebAssembly.Exports> {
    if (_wasmInstance) return _wasmInstance;
    const wasmPath = path.join(import.meta.dirname ?? __dirname, "..", "assets", "sha3_wasm.wasm");
    const wasmBuf = fs.readFileSync(wasmPath);
    const { instance } = await WebAssembly.instantiate(wasmBuf, {
        wbg: { __wbindgen_throw: () => { throw new Error("WASM error"); } }
    });
    _wasmInstance = instance.exports;
    return _wasmInstance;
}

export interface PowChallenge {
    algorithm: string;
    challenge: string;
    salt: string;
    difficulty: number;
    signature: string;
    expire_at?: string;
    expireAt?: string;
}

export async function solvePoW(challenge: PowChallenge): Promise<Record<string, unknown>> {
    const { algorithm, challenge: ch, salt, difficulty, signature, expire_at, expireAt } = challenge;
    const prefix = `${salt}_${expireAt ?? expire_at}_`;

    const wasm = await loadWasm();
    const memory = wasm.memory as WebAssembly.Memory;
    let cachedUint8: Uint8Array | null = null;
    const getUint8 = (): Uint8Array => {
        if (!cachedUint8 || cachedUint8.buffer !== memory.buffer) cachedUint8 = new Uint8Array(memory.buffer);
        return cachedUint8;
    };
    let cachedDV: DataView | null = null;
    const getDV = (): DataView => {
        if (!cachedDV || cachedDV.buffer !== memory.buffer) cachedDV = new DataView(memory.buffer);
        return cachedDV;
    };

    const encoder = new TextEncoder();
    let WLEN = 0;
    function passStr(str: string): number {
        const buf = encoder.encode(str);
        const ptr = (wasm.__wbindgen_export_0 as (len: number, align: number) => number)(buf.length, 1) >>> 0;
        getUint8().subarray(ptr, ptr + buf.length).set(buf);
        WLEN = buf.length;
        return ptr;
    }

    const retptr = (wasm.__wbindgen_add_to_stack_pointer as (delta: number) => number)(-16);
    try {
        const chPtr = passStr(ch);
        const chLen = WLEN;
        const pfPtr = passStr(prefix);
        const pfLen = WLEN;
        (wasm.wasm_solve as Function)(retptr, chPtr, chLen, pfPtr, pfLen, difficulty);
        const code = getDV().getInt32(retptr, true);
        const answer = getDV().getFloat64(retptr + 8, true);
        if (code === 0) throw new Error("PoW: no solution found");
        return { algorithm, challenge: ch, salt, answer: Math.round(answer), signature };
    } finally {
        (wasm.__wbindgen_add_to_stack_pointer as Function)(16);
    }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeepSeekResponse {
    data?: { biz_data?: Record<string, unknown>; [key: string]: unknown };
    _status?: number;
    _headers?: Record<string, string>;
    [key: string]: unknown;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripProviderPrefix(model: string): string {
    const slash = model.indexOf("/");
    return slash >= 0 ? model.slice(slash + 1) : model;
}

function mapModelToType(model: string): string {
    const lower = model.toLowerCase();
    if (lower.includes("reasoner") || lower.includes("r1")) return "deepseek-reasoner";
    return "default";
}

// ── Executor ─────────────────────────────────────────────────────────────────

export interface DeepSeekScraperExecutorOptions {
    id?: string;
    name?: string;
    baseUrl?: string;
    token?: string;
}

export class DeepSeekScraperExecutor implements AIProvider {
    id: string;
    name: string;
    category = "api_key" as const;
    protocol = "openai" as const;
    protected baseUrl: string;
    protected token: string;
    private sessions = new Map<string, { lastMessageId: string | null }>();

    constructor(options: DeepSeekScraperExecutorOptions = {}) {
        this.id = options.id ?? "deepseek";
        this.name = options.name ?? "DeepSeek (Scraper)";
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
        this.token = options.token ?? "";
    }

    updateToken(token: string): void {
        if (token) this.token = token;
    }

    protected headers(extra: Record<string, string> = {}): Record<string, string> {
        return {
            Accept: "*/*",
            "User-Agent": UA,
            Origin: this.baseUrl,
            Referer: `${this.baseUrl}/`,
            "Accept-Language": "en-US,en;q=0.9",
            "x-app-version": "2.0.0",
            "x-client-version": "2.0.0",
            "x-client-platform": "web",
            "x-client-locale": "en_US",
            "x-client-timezone-offset": "25200",
            Authorization: `Bearer ${this.token}`,
            ...extra
        };
    }

    protected request(method: string, urlPath: string, body?: Record<string, unknown>): Promise<DeepSeekResponse> {
        return new Promise((resolve, reject) => {
            const contentHeaders: Record<string, string> = {};
            let bodyBuf: Buffer | null = null;
            if (body) {
                bodyBuf = Buffer.from(JSON.stringify(body));
                contentHeaders["Content-Type"] = "application/json";
                contentHeaders["Content-Length"] = String(bodyBuf.length);
            }
            const url = new URL(`${this.baseUrl}${urlPath}`);
            const req = https.request(
                { hostname: url.hostname, path: url.pathname + url.search, method, headers: this.headers(contentHeaders), timeout: 30_000 },
                (res) => {
                    const chunks: Buffer[] = [];
                    res.on("data", (c: Buffer) => chunks.push(c));
                    res.on("end", () => {
                        const raw = Buffer.concat(chunks).toString("utf8");
                        try {
                            resolve({ ...JSON.parse(raw) as Record<string, unknown>, _status: res.statusCode, _headers: res.headers as Record<string, string> });
                        } catch {
                            resolve({ raw: raw as unknown as string, _status: res.statusCode, _headers: res.headers as Record<string, string> });
                        }
                    });
                    res.on("error", reject);
                }
            );
            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
            if (bodyBuf) req.write(bodyBuf);
            req.end();
        });
    }

    protected streamRequest(urlPath: string, body: Record<string, unknown>, extra: Record<string, string> = {}): Promise<import("node:http").IncomingMessage> {
        return new Promise((resolve, reject) => {
            const bodyStr = JSON.stringify(body);
            const url = new URL(`${this.baseUrl}${urlPath}`);
            const req = https.request(
                { hostname: url.hostname, path: url.pathname, method: "POST", headers: this.headers({ Accept: "text/event-stream", "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(bodyStr)), ...extra }) },
                (res) => {
                    if (res.statusCode && res.statusCode >= 400) {
                        const chunks: Buffer[] = [];
                        res.on("data", (c: Buffer) => chunks.push(c));
                        res.on("end", () => reject(new Error(`HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString("utf8")}`)));
                        return;
                    }
                    resolve(res);
                }
            );
            req.on("error", reject);
            req.write(bodyStr);
            req.end();
        });
    }

    protected async getPowHeader(targetPath: string): Promise<string> {
        const res = await this.request("POST", API.POW_CHALLENGE, { target_path: targetPath });
        const bizData = res?.data?.biz_data as Record<string, unknown> | undefined;
        const challenge = (bizData?.challenge ?? res?.data?.challenge) as PowChallenge | undefined;
        if (!challenge) throw new Error("No PoW challenge received");
        const pow = await solvePoW(challenge);
        return Buffer.from(JSON.stringify({ ...pow, target_path: targetPath })).toString("base64");
    }

    private async createSession(): Promise<string> {
        const res = await this.request("POST", API.CREATE_SESSION, {});
        const bizData = res?.data?.biz_data as Record<string, unknown> | undefined;
        // Response format varies: sometimes { biz_data: { id: "..." } }
        // sometimes { biz_data: { chat_session: { id: "..." } } }
        const sessionId = (bizData?.id as string) ?? ((bizData?.chat_session as { id?: string })?.id);
        if (!sessionId) throw new Error("Failed to create session");
        this.sessions.set(sessionId, { lastMessageId: null });
        return sessionId;
    }

    private async chatStream(sessionId: string, prompt: string, modelType: string, thinking: boolean): Promise<import("node:http").IncomingMessage> {
        const powHeader = await this.getPowHeader(API.CHAT);
        return this.streamRequest(
            API.CHAT,
            { chat_session_id: sessionId, parent_message_id: null, model_type: modelType, prompt, ref_file_ids: [], thinking_enabled: thinking, search_enabled: true, preempt: false },
            { "X-Ds-Pow-Response": powHeader }
        );
    }

    protected extractPrompt(req: ChatCompletionRequest): string {
        return req.messages.map((msg) => {
            const content = typeof msg.content === "string" ? msg.content : Array.isArray(msg.content) ? msg.content.map((p) => p.text ?? "").join("") : "";
            if (msg.role === "system") return `[System] ${content}`;
            if (msg.role === "assistant") return `[Assistant] ${content}`;
            return content;
        }).join("\n\n");
    }

    private isThinkingEnabled(req: ChatCompletionRequest): boolean {
        const raw = req as unknown as Record<string, unknown>;
        if (raw.thinking === true || raw.enable_thinking === true) return true;
        if (typeof raw.thinking === "object" && raw.thinking !== null) {
            if ((raw.thinking as Record<string, unknown>).type === "enabled") return true;
        }
        return Boolean(req.reasoning_effort && req.reasoning_effort !== "none");
    }

    // ── AIProvider interface ──────────────────────────────────────────────

    async listModels(): Promise<ModelObject[]> {
        return DEEPSEEK_MODELS;
    }

    async chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        const modelType = mapModelToType(stripProviderPrefix(req.model));
        const prompt = this.extractPrompt(req);
        const thinking = this.isThinkingEnabled(req);
        const sessionId = await this.createSession();
        const stream = await this.chatStream(sessionId, prompt, modelType, thinking);
        const result = await parseSSEStream(stream);

        return {
            id: `chatcmpl-${crypto.randomUUID()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: req.model,
            choices: [{ index: 0, message: { role: "assistant", content: result.content }, finish_reason: "stop" }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        };
    }

    async *chatCompletionStream(req: ChatCompletionRequest): AsyncGenerator<ChatCompletionChunk, void, void> {
        const modelType = mapModelToType(stripProviderPrefix(req.model));
        const prompt = this.extractPrompt(req);
        const thinking = this.isThinkingEnabled(req);
        const sessionId = await this.createSession();
        const res = await this.chatStream(sessionId, prompt, modelType, thinking);

        const chunkId = `chatcmpl-${crypto.randomUUID()}`;
        const created = Math.floor(Date.now() / 1000);

        yield { id: chunkId, object: "chat.completion.chunk", created, model: req.model, choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] };

        let lastPath: string | null = null;
        let content = "";
        for await (const line of streamNodeLines(res)) {
            const jsonStr = parseDataLine(line);
            if (jsonStr === null) continue;
            try {
                const ev = JSON.parse(jsonStr) as Record<string, unknown>;
                const v = ev.v as Record<string, unknown> | undefined;

                if (v?.response && typeof v.response === "object") {
                    const resp = v.response as Record<string, unknown>;
                    if (Array.isArray(resp.fragments)) {
                        for (const frag of resp.fragments as Array<Record<string, unknown>>) {
                            if (frag.type === "RESPONSE" && typeof frag.content === "string") {
                                content += frag.content;
                                yield { id: chunkId, object: "chat.completion.chunk", created, model: req.model, choices: [{ index: 0, delta: { content: frag.content }, finish_reason: null }] };
                                lastPath = "response/fragments/-1/content";
                            }
                        }
                        continue;
                    }
                }

                if (ev.p !== undefined) {
                    lastPath = ev.p as string;
                    if (typeof ev.v === "string" && (ev.p as string).includes("/content") && !(ev.p as string).includes("thinking")) {
                        content += ev.v;
                        yield { id: chunkId, object: "chat.completion.chunk", created, model: req.model, choices: [{ index: 0, delta: { content: ev.v }, finish_reason: null }] };
                    }
                    continue;
                }

                if (ev.v !== undefined && ev.o === undefined && ev.p === undefined) {
                    if (typeof ev.v === "string" && lastPath?.includes("/content") && !lastPath.includes("thinking")) {
                        content += ev.v;
                        yield { id: chunkId, object: "chat.completion.chunk", created, model: req.model, choices: [{ index: 0, delta: { content: ev.v }, finish_reason: null }] };
                    }
                }
            } catch { /* ignore */ }
        }

        const promptTokens = Math.ceil(prompt.length / 4);
        const completionTokens = Math.ceil(content.length / 4);
        yield {
            id: chunkId, object: "chat.completion.chunk", created, model: req.model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens }
        };
    }
}

// ── SSE Parser (module-level, used by both sync and stream paths) ────────────

export async function* streamNodeLines(stream: import("node:http").IncomingMessage): AsyncGenerator<string, void, void> {
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    for await (const chunk of stream) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) yield trimmed;
        }
    }
    if (buffer.trim()) yield buffer.trim();
}

function parseSSEStream(stream: import("node:http").IncomingMessage): Promise<{ content: string; messageId: string | null }> {
    return new Promise((resolve, reject) => {
        let buf = "", content = "", messageId: string | null = null, lastPath: string | null = null;
        function processLine(line: string): void {
            if (!line.startsWith("data:")) return;
            const raw = line.slice(5).trim();
            if (raw === "[DONE]") return;
            try {
                const ev = JSON.parse(raw) as Record<string, unknown>;
                if (ev.response_message_id) messageId = ev.response_message_id as string;
                const v = ev.v as Record<string, unknown> | undefined;
                if (v?.response && typeof v.response === "object") {
                    const resp = v.response as Record<string, unknown>;
                    if (Array.isArray(resp.fragments)) {
                        for (const frag of resp.fragments as Array<Record<string, unknown>>) {
                            if (frag.type === "RESPONSE" && typeof frag.content === "string") { content += frag.content; lastPath = "response/fragments/-1/content"; }
                        }
                        if (resp.message_id) messageId = resp.message_id as string;
                        return;
                    }
                }
                if (ev.p !== undefined) { lastPath = ev.p as string; if (typeof ev.v === "string" && (ev.p as string).includes("/content") && !(ev.p as string).includes("thinking")) content += ev.v; return; }
                if (ev.v !== undefined && ev.o === undefined && ev.p === undefined) { if (typeof ev.v === "string" && lastPath?.includes("/content") && !lastPath.includes("thinking")) content += ev.v; }
            } catch { /* ignore */ }
        }
        stream.on("data", (chunk: Buffer) => { buf += chunk.toString("utf8"); const lines = buf.split("\n"); buf = lines.pop() ?? ""; for (const l of lines) processLine(l.trim()); });
        stream.on("end", () => { if (buf.trim()) processLine(buf.trim()); resolve({ content, messageId }); });
        stream.on("error", reject);
    });
}
