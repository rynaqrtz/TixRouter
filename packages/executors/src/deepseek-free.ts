import crypto from "node:crypto";
import https from "node:https";
import { DeepSeekScraperExecutor, streamNodeLines } from "./deepseek-scraper.js";
import { parseDataLine } from "./base.js";
import type {
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ModelObject
} from "@rynarouter/types";

const LOGIN_PATH = "/api/v0/users/login";
const SESSION_PATH = "/api/v0/chat_session/create";
const CHAT_PATH = "/api/v0/chat/completion";
const UPLOAD_PATH = "/api/v0/file/upload_file";
const FILES_PATH = "/api/v0/file/fetch_files";

const MODELS: ModelObject[] = [
    { id: "dsfree/deepseek-v3", object: "model", owned_by: "deepseek" },
    { id: "dsfree/deepseek-r1", object: "model", owned_by: "deepseek" },
    { id: "dsfree/deepseek-v4-flash", object: "model", owned_by: "deepseek" },
    { id: "dsfree/deepseek-v4-pro", object: "model", owned_by: "deepseek" }
];

type DeepSeekFreeModel = "deepseek-v3" | "deepseek-r1" | "deepseek-v4-flash" | "deepseek-v4-pro";

export function normalizeModel(model: string): DeepSeekFreeModel {
    const bare = model.includes("/") ? model.slice(model.indexOf("/") + 1) : model;
    if (bare.includes("r1") || bare.includes("reasoner")) return "deepseek-r1";
    if (bare.includes("v4-pro")) return "deepseek-v4-pro";
    if (bare.includes("v4") || bare.includes("flash")) return "deepseek-v4-flash";
    return "deepseek-v3";
}

export interface ParsedDataUrl {
    mime: string;
    buffer: Buffer;
}

export function parseDataUrl(url: string): ParsedDataUrl | null {
    const match = /^data:([^;,]+);base64,(.+)$/s.exec(url);
    if (!match) return null;
    return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

export function imageDataUrls(req: ChatCompletionRequest): string[] {
    return req.messages.flatMap((msg) =>
        Array.isArray(msg.content)
            ? msg.content.filter((p) => p.type === "image_url" && p.image_url?.url).map((p) => p.image_url!.url)
            : []
    );
}

export interface DeepSeekFreeExecutorOptions {
    id?: string;
    name?: string;
    email?: string;
    password?: string;
    token?: string;
}

export class DeepSeekFreeExecutor extends DeepSeekScraperExecutor {
    private email: string;
    private password: string;
    private loggedIn = false;
    private loginPromise: Promise<void> | null = null;

    constructor(options: DeepSeekFreeExecutorOptions = {}) {
        super({
            id: options.id ?? "deepseek-free",
            name: options.name ?? "RYNArouter Free",
            token: options.token ?? ""
        });
        this.email = options.email?.trim() ?? "";
        this.password = options.password ?? "";
        if (!this.email || !this.password) {
            throw new Error("RYNArouter Free requires email and password");
        }
    }

    protected override headers(extra: Record<string, string> = {}): Record<string, string> {
        return {
            "x-client-platform": "android",
            "x-client-version": "2.3.1",
            "x-client-locale": "id",
            "x-client-bundle-id": "com.deepseek.chat",
            "x-rangers-id": "7700431188367789825",
            "x-client-timezone-offset": "25200",
            "User-Agent": "DeepSeek/2.3.1 Android/33",
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
            ...extra
        };
    }

    updateCredentials(credentials: { email?: string; password?: string; token?: string }): void {
        if (credentials.email) this.email = credentials.email;
        if (credentials.password) this.password = credentials.password;
        if (credentials.token) this.token = credentials.token;
        this.loggedIn = false;
        this.loginPromise = null;
    }

    private async login(): Promise<void> {
        const deviceId = `BUelgEoBdkHyhwE8q/4YOodITQ1Ef99t7Y5KAR4${crypto.randomBytes(4).toString("hex")}`;
        const res = await this.request("POST", LOGIN_PATH, {
            email: this.email,
            password: this.password,
            device_id: deviceId,
            os: "android"
        });
        const biz = res?.data?.biz_data as { user?: { token?: string } } | undefined;
        const token = biz?.user?.token;
        if (!token) {
            const msg = String((res as { msg?: unknown }).msg ?? "no token in response");
            throw new Error(`RYNArouter Free login failed: ${msg}`);
        }
        this.token = token;
        this.loggedIn = true;
    }

    private async ensureToken(): Promise<void> {
        if (this.loggedIn && this.token) return;
        if (!this.loginPromise) {
            this.loginPromise = this.login().finally(() => {
                this.loginPromise = null;
            });
        }
        await this.loginPromise;
    }

    private uploads = new Map<string, Promise<string>>();

    private multipartRequest(path: string, body: Buffer, boundary: string, pow: string): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            const url = new URL(`${this.baseUrl}${path}`);
            const req = https.request(
                {
                    hostname: url.hostname,
                    path: url.pathname,
                    method: "POST",
                    headers: this.headers({
                        "x-ds-pow-response": pow,
                        "x-file-size": String(body.length),
                        "x-model-type": "vision",
                        "Content-Type": `multipart/form-data; boundary=${boundary}`,
                        "Content-Length": String(body.length)
                    })
                },
                (res) => {
                    const chunks: Buffer[] = [];
                    res.on("data", (c: Buffer) => chunks.push(c));
                    res.on("end", () => {
                        try {
                            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
                        } catch {
                            reject(new Error(`RYNArouter Free upload: invalid response (HTTP ${res.statusCode})`));
                        }
                    });
                    res.on("error", reject);
                }
            );
            req.on("error", reject);
            req.write(body);
            req.end();
        });
    }

    async uploadFile(file: ParsedDataUrl): Promise<string> {
        if (file.buffer.length > 20 * 1024 * 1024) {
            throw new Error("RYNArouter Free upload too large (max 20MB)");
        }
        const key = crypto.createHash("sha256").update(file.buffer).digest("hex");
        const cached = this.uploads.get(key);
        if (cached) return cached;
        const pending = (async () => {
            const pow = await this.getPowHeader(UPLOAD_PATH);
            const ext = file.mime.split("/")[1] ?? "bin";
            const filename = `image.${ext}`;
            const boundary = `----ryna${Date.now().toString(16)}${crypto.randomBytes(4).toString("hex")}`;
            const head = Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
            );
            const body = Buffer.concat([head, file.buffer, Buffer.from(`\r\n--${boundary}--\r\n`)]);
            const res = (await this.multipartRequest(UPLOAD_PATH, body, boundary, pow)) as {
                code?: number;
                msg?: string;
                data?: { biz_data?: { id?: string } };
            };
            if (res.code !== 0 || !res.data?.biz_data?.id) {
                throw new Error(`RYNArouter Free upload failed: ${res.msg ?? "unknown"}`);
            }
            const fileId = res.data.biz_data.id;
            for (let i = 0; i < 20; i++) {
                await new Promise((r) => setTimeout(r, 1500));
                const poll = await this.request("GET", `${FILES_PATH}?file_ids=${fileId}`);
                const files = (poll?.data?.biz_data as { files?: Array<{ status?: string; error_code?: string }> } | undefined)?.files;
                if (files?.[0]?.status === "SUCCESS") return fileId;
                if (files?.[0]?.status === "FAILED") throw new Error(`RYNArouter Free file processing failed: ${files[0].error_code ?? "unknown"}`);
            }
            throw new Error("RYNArouter Free file processing timeout");
        })();
        this.uploads.set(key, pending);
        pending.catch(() => this.uploads.delete(key));
        return pending;
    }

    private async refFileIds(req: ChatCompletionRequest): Promise<string[]> {
        const urls = imageDataUrls(req);
        if (!urls.length) return [];
        const ids: string[] = [];
        for (const url of urls) {
            const parsed = parseDataUrl(url);
            if (parsed) ids.push(await this.uploadFile(parsed));
        }
        return ids;
    }

    private async openSession(): Promise<string> {
        const res = await this.request("POST", SESSION_PATH, {});
        const biz = res?.data?.biz_data as Record<string, unknown> | undefined;
        const sessionId =
            (biz?.id as string | undefined) ?? ((biz?.chat_session as { id?: string } | undefined)?.id ?? null);
        if (!sessionId) throw new Error("RYNArouter Free: failed to create chat session");
        return sessionId;
    }

    private async startChat(req: ChatCompletionRequest): Promise<import("node:http").IncomingMessage> {
        await this.ensureToken();
        const sessionId = await this.openSession();
        const refFileIds = await this.refFileIds(req);
        const normalized = normalizeModel(req.model);
        const thinking = normalized === "deepseek-r1";
        const pow = await this.getPowHeader(CHAT_PATH);
        return this.streamRequest(
            CHAT_PATH,
            {
                chat_session_id: sessionId,
                parent_message_id: null,
                prompt: this.extractPrompt(req),
                ref_file_ids: refFileIds,
                thinking_enabled: thinking,
                search_enabled: false,
                audio_id: null,
                preempt: false,
                model_type: "default",
                model: normalized,
                action: null
            },
            { "X-Ds-Pow-Response": pow, "x-thinking-enabled": thinking ? "1" : "0" }
        );
    }

    private isAuthError(err: unknown): boolean {
        return err instanceof Error && /HTTP 401/.test(err.message);
    }

    private async startChatWithRetry(req: ChatCompletionRequest): Promise<import("node:http").IncomingMessage> {
        try {
            return await this.startChat(req);
        } catch (err) {
            if (!this.isAuthError(err)) throw err;
            await this.login();
            return this.startChat(req);
        }
    }

    async listModels(): Promise<ModelObject[]> {
        return MODELS;
    }

    async chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        const stream = await this.startChatWithRetry(req);
        let content = "";
        let reasoning = "";
        for await (const line of streamNodeLines(stream)) {
            const data = parseDataLine(line);
            if (data === null) continue;
            try {
                const frag = extractFragment(JSON.parse(data) as Record<string, unknown>);
                if (!frag) continue;
                if (frag.type === "THINKING") reasoning += frag.content;
                else content += frag.content;
            } catch {}
        }
        const message: ChatCompletionResponse["choices"][number]["message"] = {
            role: "assistant",
            content
        };
        if (reasoning) message.reasoning_content = reasoning;
        const promptTokens = Math.ceil(this.extractPrompt(req).length / 4);
        const completionTokens = Math.ceil((content.length + reasoning.length) / 4);
        return {
            id: `chatcmpl-${crypto.randomUUID()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: req.model,
            choices: [{ index: 0, message, finish_reason: "stop" }],
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens
            }
        };
    }

    async *chatCompletionStream(req: ChatCompletionRequest): AsyncGenerator<ChatCompletionChunk, void, void> {
        const stream = await this.startChatWithRetry(req);
        const chunkId = `chatcmpl-${crypto.randomUUID()}`;
        const created = Math.floor(Date.now() / 1000);
        const promptTokens = Math.ceil(this.extractPrompt(req).length / 4);
        const base = { id: chunkId, object: "chat.completion.chunk" as const, created, model: req.model };

        yield { ...base, choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] };

        let content = "";
        let reasoningStarted = false;
        for await (const line of streamNodeLines(stream)) {
            const data = parseDataLine(line);
            if (data === null) continue;
            let frag: { type: string; content: string } | null = null;
            try {
                frag = extractFragment(JSON.parse(data) as Record<string, unknown>);
            } catch {
                continue;
            }
            if (!frag || !frag.content) continue;
            if (frag.type === "THINKING") {
                reasoningStarted = true;
                yield { ...base, choices: [{ index: 0, delta: { reasoning_content: frag.content }, finish_reason: null }] };
            } else {
                if (reasoningStarted && !content) {
                    yield { ...base, choices: [{ index: 0, delta: { reasoning_content: "" }, finish_reason: null }] };
                }
                content += frag.content;
                yield { ...base, choices: [{ index: 0, delta: { content: frag.content }, finish_reason: null }] };
            }
        }

        const completionTokens = Math.ceil(content.length / 4);
        yield {
            ...base,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens
            }
        };
    }
}

function extractFragment(ev: Record<string, unknown>): { type: string; content: string } | null {
    const v = ev.v as Record<string, unknown> | undefined;
    if (v?.response && typeof v.response === "object") {
        const resp = v.response as { fragments?: Array<Record<string, unknown>> };
        if (Array.isArray(resp.fragments)) {
            for (const frag of resp.fragments) {
                if (typeof frag.content === "string" && frag.content) {
                    return { type: String(frag.type ?? "RESPONSE"), content: frag.content };
                }
            }
        }
        return null;
    }
    const path = typeof ev.p === "string" ? ev.p : null;
    if (path && typeof ev.v === "string") {
        if (path.includes("thinking")) return { type: "THINKING", content: ev.v };
        if (path.includes("/content")) return { type: "RESPONSE", content: ev.v };
        return null;
    }
    if (path === null && typeof ev.v === "string") {
        return { type: "RESPONSE", content: ev.v };
    }
    return null;
}
