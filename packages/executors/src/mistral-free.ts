import crypto from "node:crypto";
import type {
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ModelObject
} from "@rynarouter/types";
import { streamLines } from "./base.js";

const BASE = "https://chat.mistral.ai";
const HEADERS = {
    "User-Agent": "le-chat-mobile/2.7.0 (build:20700421; os_name:ios; device_category:smartphone; device_model:iPhone 13 Pro; device_manufacturer:Apple)",
    Accept: "*/*",
    "Content-Type": "application/json"
};

const MODELS: ModelObject[] = [
    { id: "mfree/mistral-large", object: "model", owned_by: "mistral" }
];

type TrpcResponse = Array<{ result?: { data?: { json?: { chatId?: string } } } }>;

interface MistralSession {
    cookie: string;
    identifier: string;
}

async function trpcPost(endpoint: string, body: unknown, cookie = ""): Promise<{ status: number; text: string; cookies: string[] }> {
    const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { ...HEADERS, ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(body)
    });
    return { status: res.status, text: await res.text(), cookies: res.headers.getSetCookie() };
}

function joinCookies(jar: Record<string, string>): string {
    return Object.entries(jar)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
}

function absorbCookies(jar: Record<string, string>, setCookie: string[]): void {
    for (const raw of setCookie) {
        const pair = raw.split(";")[0];
        const eq = pair.indexOf("=");
        if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
}

async function handshake(): Promise<MistralSession> {
    const jar: Record<string, string> = {};
    const datalake = await trpcPost(
        "/api/trpc/event.sendEventToDatalake,event.sendEventToDatalake?batch=1",
        {
            "0": { json: { event: { name: "app_downloaded", properties: {} } } },
            "1": {
                json: {
                    event: {
                        name: "app_started",
                        properties: {
                            os: "iOS", osVersion: "18.3.2", deviceManufacturer: "Apple",
                            screenWidth: 430, screenHeight: 932, windowWidth: 430, windowHeight: 932,
                            pixelRatio: 3, fontScale: 1, deviceColorScheme: "dark",
                            preferredLocale: "en-US",
                            permissions: { notifications: "undetermined", camera: "undetermined", mediaLibrary: "denied" }
                        }
                    }
                }
            }
        }
    );
    absorbCookies(jar, datalake.cookies);
    await trpcPost("/api/trpc/user.acceptToS?batch=1", { "0": { json: {} } }, joinCookies(jar));
    return { cookie: joinCookies(jar), identifier: crypto.randomUUID() };
}

async function createRoom(prompt: string, session: MistralSession): Promise<string> {
    const res = await trpcPost(
        "/api/trpc/message.newChat?batch=1",
        {
            "0": {
                json: {
                    files: [],
                    content: [{ type: "text", text: prompt }],
                    transcriptionsMetadata: null, agentId: null, agentsApiAgentId: null,
                    features: ["beta-websearch"], integrations: [], libraries: [],
                    productType: "chat", projectId: null, incognito: null, chatId: null,
                    parentId: null, parentVersion: null
                },
                meta: {
                    values: {
                        transcriptionsMetadata: ["undefined"], agentId: ["undefined"],
                        agentsApiAgentId: ["undefined"], projectId: ["undefined"],
                        incognito: ["undefined"], chatId: ["undefined"],
                        parentId: ["undefined"], parentVersion: ["undefined"]
                    },
                    v: 1
                }
            }
        },
        session.cookie
    );
    let parsed: TrpcResponse;
    try {
        parsed = JSON.parse(res.text) as TrpcResponse;
    } catch {
        throw new Error(`Mistral Free room failed (HTTP ${res.status})`);
    }
    const chatId = parsed[0]?.result?.data?.json?.chatId;
    if (!chatId) throw new Error("Mistral Free room failed: no chatId");
    return chatId;
}

interface Patch {
    op?: string;
    path?: string;
    value?: unknown;
}

export function applyMistralPatch(patch: Patch): string | null {
    if (patch.op !== "replace" || typeof patch.path !== "string") return null;
    if (patch.path === "/contentChunks" && Array.isArray(patch.value)) {
        return patch.value
            .filter((c): c is { text: string } => typeof (c as { text?: unknown })?.text === "string")
            .map((c) => c.text)
            .join("") || null;
    }
    if (/^\/contentChunks\/\d+\/text$/.test(patch.path) && typeof patch.value === "string") {
        return patch.value;
    }
    return null;
}

export class MistralFreeExecutor {
    id: string;
    name: string;
    category = "free_tier" as const;
    protocol = "openai" as const;
    private session: MistralSession | null = null;
    private sessionPromise: Promise<MistralSession> | null = null;

    constructor(options: { id?: string; name?: string } = {}) {
        this.id = options.id ?? "mistral-free";
        this.name = options.name ?? "Mistral Free";
    }

    private async ensureSession(): Promise<MistralSession> {
        if (this.session) return this.session;
        if (!this.sessionPromise) {
            this.sessionPromise = handshake()
                .then((s) => {
                    this.session = s;
                    return s;
                })
                .finally(() => {
                    this.sessionPromise = null;
                });
        }
        return this.sessionPromise;
    }

    async listModels(): Promise<ModelObject[]> {
        return MODELS;
    }

    protected async *startStream(req: ChatCompletionRequest): AsyncGenerator<string, void, void> {
        const session = await this.ensureSession();
        const prompt = req.messages
            .map((msg) => {
                const content =
                    typeof msg.content === "string"
                        ? msg.content
                        : Array.isArray(msg.content)
                          ? msg.content.map((p) => p.text ?? "").join("")
                          : "";
                if (msg.role === "system") return `[System] ${content}`;
                if (msg.role === "assistant") return `[Assistant] ${content}`;
                return content;
            })
            .join("\n\n");
        const chatId = await createRoom(prompt, session);
        const res = await fetch(`${BASE}/api/chat`, {
            method: "POST",
            headers: { ...HEADERS, Cookie: session.cookie, Accept: "text/event-stream" },
            body: JSON.stringify({
                chatId,
                stableAnonymousIdentifier: session.identifier,
                platform: "mobile",
                clientPromptData: {
                    currentDate: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
                    userTimezone: "Asia/Jakarta"
                },
                shouldAwaitStreamBackgroundTasks: true,
                shouldUseMessagePatch: true,
                features: [],
                integrations: [],
                libraries: [],
                mode: "start",
                disabledFeatures: ["memory-inference"]
            })
        });
        if (!res.ok || !res.body) {
            this.session = null;
            const detail = (await res.text()).slice(0, 200);
            throw new Error(`Mistral Free HTTP ${res.status}: ${detail}`);
        }
        yield* streamLines(res.body);
    }

    async chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        let content = "";
        for await (const line of this.startStream(req)) {
            const chunk = mistralChunk(line);
            if (chunk) content += chunk;
        }
        const promptTokens = Math.ceil(promptLength(req) / 4);
        const completionTokens = Math.ceil(content.length / 4);
        return {
            id: `chatcmpl-${crypto.randomUUID()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: req.model,
            choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
            usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens }
        };
    }

    async *chatCompletionStream(req: ChatCompletionRequest): AsyncGenerator<ChatCompletionChunk, void, void> {
        const chunkId = `chatcmpl-${crypto.randomUUID()}`;
        const created = Math.floor(Date.now() / 1000);
        const promptTokens = Math.ceil(promptLength(req) / 4);
        const base = { id: chunkId, object: "chat.completion.chunk" as const, created, model: req.model };

        yield { ...base, choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] };

        let content = "";
        for await (const line of this.startStream(req)) {
            const chunk = mistralChunk(line);
            if (!chunk) continue;
            content += chunk;
            yield { ...base, choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }] };
        }

        yield {
            ...base,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: promptTokens, completion_tokens: Math.ceil(content.length / 4), total_tokens: promptTokens + Math.ceil(content.length / 4) }
        };
    }
}

function mistralChunk(line: string): string | null {
    const colon = line.indexOf(":");
    if (colon < 1) return null;
    let parsed: { json?: { type?: string; patches?: Patch[] } };
    try {
        parsed = JSON.parse(line.slice(colon + 1).trim()) as typeof parsed;
    } catch {
        return null;
    }
    const data = parsed?.json;
    if (!data || data.type !== "message" || !Array.isArray(data.patches)) return null;
    for (const patch of data.patches) {
        const chunk = applyMistralPatch(patch);
        if (chunk) return chunk;
    }
    return null;
}

function promptLength(req: ChatCompletionRequest): number {
    return req.messages.reduce((sum, msg) => {
        const content =
            typeof msg.content === "string"
                ? msg.content
                : Array.isArray(msg.content)
                  ? msg.content.map((p) => p.text ?? "").join("")
                  : "";
        return sum + content.length;
    }, 0);
}
