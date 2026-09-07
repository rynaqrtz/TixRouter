import type {
    ChatCompletionChunk,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ModelObject
} from "@tixrouter/types";
import { DeepSeekFreeExecutor } from "./deepseek-free.js";

const COOLDOWN_MS = 60_000;
const COOLDOWN_ERRORS = /HTTP 429|HTTP 401|login failed/;

export function parseAccounts(raw: string): Array<{ email: string; password: string }> {
    return raw
        .split(/[;\n]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const sep = entry.indexOf(":");
            if (sep < 0) return { email: "", password: "" };
            return { email: entry.slice(0, sep).trim(), password: entry.slice(sep + 1) };
        })
        .filter((account) => account.email && account.password);
}

export type DeepSeekFreePoolFactory = (account: { email: string; password: string }) => DeepSeekFreeExecutor;

export interface DeepSeekFreePoolOptions {
    id?: string;
    name?: string;
    accounts: Array<{ email: string; password: string }>;
    executorFactory?: DeepSeekFreePoolFactory;
}

interface PoolMember {
    executor: DeepSeekFreeExecutor;
    blockedUntil: number;
}

export class DeepSeekFreePoolExecutor {
    id: string;
    name: string;
    private members: PoolMember[];
    private cursor = 0;

    constructor(options: DeepSeekFreePoolOptions) {
        const accounts = options.accounts.filter((a) => a.email && a.password);
        if (!accounts.length) {
            throw new Error("TixRouter Free pool requires at least one account");
        }
        this.id = options.id ?? "deepseek-free";
        this.name = options.name ?? "TixRouter Free";
        const factory = options.executorFactory ?? ((account) => new DeepSeekFreeExecutor({ email: account.email, password: account.password }));
        this.members = accounts.map((account) => ({ executor: factory(account), blockedUntil: 0 }));
    }

    private pick(): PoolMember {
        const now = Date.now();
        const n = this.members.length;
        for (let i = 0; i < n; i++) {
            const index = (this.cursor + i) % n;
            const member = this.members[index];
            if (member.blockedUntil <= now) {
                this.cursor = index;
                return member;
            }
        }
        const soonest = Math.min(...this.members.map((m) => m.blockedUntil));
        throw new Error(`TixRouter Free pool: all ${n} accounts cooling down, retry in ${Math.ceil((soonest - now) / 1000)}s`);
    }

    private bench(member: PoolMember, err: unknown): void {
        if (err instanceof Error && COOLDOWN_ERRORS.test(err.message)) {
            member.blockedUntil = Date.now() + COOLDOWN_MS;
        }
    }

    async listModels(): Promise<ModelObject[]> {
        return this.members[0].executor.listModels();
    }

    async chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        let lastErr: unknown = new Error("TixRouter Free pool: no account could complete the request");
        for (let attempt = 0; attempt < this.members.length; attempt++) {
            const member = this.pick();
            try {
                return await member.executor.chatCompletion(req);
            } catch (err) {
                this.bench(member, err);
                lastErr = err;
            }
        }
        throw lastErr;
    }

    async *chatCompletionStream(req: ChatCompletionRequest): AsyncGenerator<ChatCompletionChunk, void, void> {
        let member: PoolMember | null = null;
        let iterator: AsyncGenerator<ChatCompletionChunk, void, void> | null = null;
        let first: IteratorResult<ChatCompletionChunk, void> | null = null;
        let lastErr: unknown;
        for (let attempt = 0; attempt < this.members.length; attempt++) {
            member = this.pick();
            iterator = member.executor.chatCompletionStream(req);
            try {
                first = await iterator.next();
                break;
            } catch (err) {
                this.bench(member, err);
                lastErr = err;
            }
        }
        if (!first || !iterator || !member) {
            throw lastErr ?? new Error("TixRouter Free pool: no account could start the stream");
        }
        if (first.done) return;
        yield first.value;
        try {
            yield* iterator;
        } catch (err) {
            this.bench(member, err);
            throw err;
        }
    }
}
