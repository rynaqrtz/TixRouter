import { useState, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, Eraser, Send, TriangleAlert, User } from "lucide-react";
import { api, getGatewayBaseUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PlaygroundSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/playground")({
    staticData: { title: "Playground" },
    component: PlaygroundPage
});

interface ChatTurn {
    role: "user" | "assistant";
    content: string;
    model?: string;
}

interface ModelInfo {
    id: string;
    owned_by?: string;
}

interface ModelsResponse {
    data: ModelInfo[];
}

function ChatArea({
    model,
    turns,
    onSend,
    streaming,
    error
}: {
    model: string;
    turns: ChatTurn[];
    onSend: (text: string) => void;
    streaming: boolean;
    error: string | null;
}) {
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [turns, streaming]);

    return (
        <div className="flex h-full min-h-[28rem] flex-col rounded-xl border border-border/80 bg-card/60 shadow-2xs overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {turns.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground mt-16">
                        Send a message to test <span className="text-foreground font-semibold">{model}</span> through the gateway.
                    </p>
                )}
                {turns.map((t, i) => (
                    <div key={i} className={`flex gap-2.5 ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                            className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                                t.role === "user"
                                    ? "bg-foreground text-background"
                                    : "bg-secondary/50 border border-border/60 text-foreground"
                            }`}
                        >
                            {t.role === "assistant" && t.model && (
                                <span className="block text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
                                    {t.model}
                                </span>
                            )}
                            {t.content}
                        </div>
                    </div>
                ))}
                {streaming && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-1">
                        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Streaming…
                    </div>
                )}
                {error && (
                    <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-500">
                        <TriangleAlert className="size-3.5 shrink-0" />
                        {error}
                    </div>
                )}
            </div>
            <form
                className="flex items-center gap-2 border-t border-border/60 p-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    const text = input.trim();
                    if (!text || streaming) return;
                    onSend(text);
                    setInput("");
                }}
            >
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Message the gateway…"
                    className="flex-1 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button type="submit" size="sm" disabled={streaming || !input.trim()} className="h-8 cursor-pointer gap-1.5">
                    <Send className="size-3.5" />
                    Send
                </Button>
            </form>
        </div>
    );
}

async function streamCompletion(
    baseUrl: string,
    model: string,
    messages: { role: string; content: string }[],
    onDelta: (text: string) => void
): Promise<void> {
    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true })
    });
    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const body = (await res.json()) as { error?: { message?: string } | string };
            message = typeof body.error === "string" ? body.error : (body.error?.message ?? message);
        } catch {
            // ignore
        }
        throw new Error(message);
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Streaming not supported by browser");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") return;
            try {
                const chunk = JSON.parse(payload) as {
                    choices?: Array<{ delta?: { content?: string } }>;
                };
                const delta = chunk.choices?.[0]?.delta?.content;
                if (delta) onDelta(delta);
            } catch {
                // skip malformed chunk
            }
        }
    }
}

function PlaygroundPage() {
    const baseUrl = getGatewayBaseUrl();
    const { data: modelsData, isPending } = useQuery({
        queryKey: ["models"],
        queryFn: () => api.get<ModelsResponse>("/v1/models")
    });

    const models = modelsData?.data ?? [];
    const modelOptions = models.length > 0 ? models.map((m) => m.id) : ["gpt-4o-mini"];

    const [modelA, setModelA] = useState(modelOptions[0] ?? "gpt-4o-mini");
    const [modelB, setModelB] = useState(modelOptions[1] ?? modelOptions[0] ?? "gpt-4o-mini");
    const [compare, setCompare] = useState(false);
    const [turnsA, setTurnsA] = useState<ChatTurn[]>([]);
    const [turnsB, setTurnsB] = useState<ChatTurn[]>([]);
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (isPending) return <PlaygroundSkeleton />;

    const handleSend = async (text: string) => {
        setError(null);
        setStreaming(true);
        const messages = [{ role: "user", content: text }];
        try {
            const target = compare ? modelA : modelA;
            const assistant: ChatTurn = { role: "assistant", content: "", model: target };
            setTurnsA((prev) => [...prev, { role: "user", content: text }, assistant]);
            await streamCompletion(baseUrl, target, messages, (delta) => {
                setTurnsA((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1]!;
                    next[next.length - 1] = { ...last, content: last.content + delta };
                    return next;
                });
            });
            if (compare) {
                const assistantB: ChatTurn = { role: "assistant", content: "", model: modelB };
                setTurnsB((prev) => [...prev, { role: "user", content: text }, assistantB]);
                await streamCompletion(baseUrl, modelB, messages, (delta) => {
                    setTurnsB((prev) => {
                        const next = [...prev];
                        const last = next[next.length - 1]!;
                        next[next.length - 1] = { ...last, content: last.content + delta };
                        return next;
                    });
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Request failed");
            setTurnsA((prev) => prev.slice(0, -1));
            setTurnsB((prev) => prev.slice(0, -1));
        } finally {
            setStreaming(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 font-mono">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end border-b border-border/80 pb-5">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                        Test Console
                    </p>
                    <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">Playground</h1>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                        Chat directly through the gateway. Toggle compare to see two models side by side.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setCompare((c) => !c)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            compare ? "bg-amber-500 text-background" : "bg-secondary/30 text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Compare
                    </button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs cursor-pointer gap-1.5"
                        onClick={() => {
                            setTurnsA([]);
                            setTurnsB([]);
                            setError(null);
                        }}
                    >
                        <Eraser className="size-3" />
                        Clear
                    </Button>
                </div>
            </header>

            <div className="flex flex-col gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                    Model
                </label>
                <select
                    value={modelA}
                    onChange={(e) => setModelA(e.target.value)}
                    className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                    {modelOptions.map((m) => (
                        <option key={m} value={m}>
                            {m}
                        </option>
                    ))}
                </select>
            </div>

            {compare && (
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                        Compare with
                    </label>
                    <select
                        value={modelB}
                        onChange={(e) => setModelB(e.target.value)}
                        className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                        {modelOptions.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className={`grid gap-5 ${compare ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Bot className="size-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                            {modelA}
                        </span>
                    </div>
                    <ChatArea
                        model={modelA}
                        turns={turnsA}
                        onSend={(text) => void handleSend(text)}
                        streaming={streaming}
                        error={error}
                    />
                </div>
                {compare && (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <User className="size-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                                {modelB}
                            </span>
                        </div>
                        <ChatArea
                            model={modelB}
                            turns={turnsB}
                            onSend={(text) => void handleSend(text)}
                            streaming={streaming}
                            error={error}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}