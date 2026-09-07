import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Check,
    ChevronDown,
    Copy,
    FileJson,
    KeyRound,
    Layers,
    Search,
    Terminal
} from "lucide-react";
import { api } from "@/lib/api";
import { useCopy } from "@/hooks/useCopy";
import { useFallbacks } from "@/hooks/useFallbacks";
import { ProviderIcon } from "@/components/ProviderIcon";
import { Button } from "@/components/ui/button";
import { CLI_VERSION, KNOWN_PROVIDERS } from "@tixrouter/constants";
import type { APIKeyZod, ModelListResponse } from "@tixrouter/types";
import type { FallbackRule } from "@tixrouter/types";

/* ─── Tool Definitions ────────────────────────────────────────────── */

interface CLIToolDef {
    id: string;
    name: string;
    description: string;
    icon: string;
    image: string;
    color: string;
    configPaths: string[];
    installCmd: string;
}

const CLI_TOOLS: CLIToolDef[] = [
    {
        id: "opencode",
        name: "OpenCode",
        description: "AI coding assistant with multi-model support",
        icon: "OC",
        image: "/providers/opencode.png",
        color: "#E87040",
        configPaths: ["~/.config/opencode/opencode.json"],
        installCmd: "npm install -g opencode-ai"
    },
    {
        id: "claude-code",
        name: "Claude Code",
        description: "Anthropic's official CLI coding assistant",
        icon: "CC",
        image: "/providers/claude.png",
        color: "#D97757",
        configPaths: ["~/.claude/settings.json"],
        installCmd: "npm install -g @anthropic-ai/claude-code"
    },
    {
        id: "cursor",
        name: "Cursor",
        description: "AI-first code editor",
        icon: "Cu",
        image: "/providers/cursor.png",
        color: "#000000",
        configPaths: ["~/.cursor/settings.json"],
        installCmd: ""
    },
    {
        id: "cline",
        name: "Cline",
        description: "Autonomous coding agent for VS Code",
        icon: "Cl",
        image: "/providers/cline.png",
        color: "#00D1B2",
        configPaths: ["~/.cline/data/globalState.json", "~/.cline/data/secrets.json"],
        installCmd: ""
    },
    {
        id: "codex",
        name: "OpenAI Codex",
        description: "OpenAI's CLI coding agent",
        icon: "CX",
        image: "/providers/codex.png",
        color: "#10A37F",
        configPaths: ["~/.codex/config.toml", "~/.codex/auth.json"],
        installCmd: "npm install -g @openai/codex"
    },
    {
        id: "copilot",
        name: "GitHub Copilot",
        description: "GitHub's AI pair programmer (VS Code)",
        icon: "GH",
        image: "/providers/copilot.png",
        color: "#1F6FEB",
        configPaths: ["~/.config/Code/User/chatLanguageModels.json"],
        installCmd: ""
    }
];

/* ─── Per-Tool Config Generators ──────────────────────────────────── */

function buildOpenCodeConfig(baseUrl: string, apiKey: string, model: string) {
    return {
        provider: {
            tixrouter: {
                npm: "@ai-sdk/openai-compatible",
                options: { baseURL: baseUrl, apiKey },
                models: {
                    [model]: { name: model, modalities: { input: ["text", "image"], output: ["text"] } }
                }
            }
        },
        model,
        agent: {
            explorer: { description: "Fast explorer subagent", mode: "subagent", model }
        }
    };
}

function buildClaudeCodeConfig(baseUrl: string, apiKey: string, model: string) {
    return {
        hasCompletedOnboarding: true,
        env: {
            ANTHROPIC_BASE_URL: baseUrl,
            ANTHROPIC_AUTH_TOKEN: apiKey,
            ANTHROPIC_DEFAULT_SONNET_MODEL: model,
            CLAUDE_CODE_MAX_CONTEXT_TOKENS: "200000"
        }
    };
}

function buildClineConfig(baseUrl: string, apiKey: string, model: string) {
    const baseUrlNoV1 = baseUrl.replace(/\/v1\/?$/, "");
    return {
        globalState: {
            actModeApiProvider: "openai",
            planModeApiProvider: "openai",
            openAiBaseUrl: baseUrlNoV1,
            openAiModelId: model,
            planModeOpenAiModelId: model
        },
        secrets: {
            openAiApiKey: apiKey
        }
    };
}

function buildCodexConfig(baseUrl: string, apiKey: string, model: string) {
    return {
        configToml: `model = "${model}"
model_provider = "tixrouter"

[model_providers.tixrouter]
name = "TixRouter"
base_url = "${baseUrl}"
wire_api = "responses"
http_headers = { Authorization = "Bearer ${apiKey}" }

[agents]
default_subagent_model = "${model}"`,
        authJson: {
            OPENAI_API_KEY: apiKey,
            auth_mode: "api-key"
        }
    };
}

function buildCopilotConfig(baseUrl: string, apiKey: string, model: string) {
    const baseUrlWithHash = `${baseUrl}/chat/completions#models.ai.azure.com`;
    return [
        {
            name: "TixRouter",
            vendor: "azure",
            apiKey,
            models: [
                {
                    id: model,
                    name: model,
                    url: baseUrlWithHash,
                    toolCalling: true,
                    vision: false,
                    maxInputTokens: 128000,
                    maxOutputTokens: 16000
                }
            ]
        }
    ];
}

function getToolConfig(toolId: string, baseUrl: string, apiKey: string, model: string) {
    switch (toolId) {
        case "opencode": return buildOpenCodeConfig(baseUrl, apiKey, model);
        case "claude-code": return buildClaudeCodeConfig(baseUrl, apiKey, model);
        case "cline": return buildClineConfig(baseUrl, apiKey, model);
        case "codex": return buildCodexConfig(baseUrl, apiKey, model);
        case "copilot": return buildCopilotConfig(baseUrl, apiKey, model);
        default: return { provider: { name: "tixrouter", api_base_url: baseUrl, api_key: apiKey }, model };
    }
}

/* ─── Dropdown ────────────────────────────────────────────────────── */

function Dropdown({
    open,
    onClose,
    trigger,
    children
}: {
    open: boolean;
    onClose: () => void;
    trigger: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="relative">
            {trigger}
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={onClose} />
                    <div className="absolute z-50 mt-1.5 w-full min-w-[280px] max-h-72 overflow-auto rounded-xl border border-border/80 bg-card shadow-xl">
                        {children}
                    </div>
                </>
            )}
        </div>
    );
}

/* ─── Model Selector ──────────────────────────────────────────────── */

function ModelSelector({
    value,
    onChange,
    combos,
    modelsData
}: {
    value: string;
    onChange: (v: string) => void;
    combos: FallbackRule[];
    modelsData: ModelListResponse | undefined;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const groups = useMemo(() => {
        const result: Array<{ label: string; icon: React.ReactNode; items: { id: string; name: string; providerId: string; isCombo?: boolean }[] }> = [];

        const comboSources = [...new Set(combos.map((c) => c.sourceModel))];
        if (comboSources.length > 0) {
            result.push({
                label: "Combos",
                icon: <Layers className="size-3.5 text-cyan-500" />,
                items: comboSources.map((src) => ({ id: src, name: src, providerId: "combo", isCombo: true }))
            });
        }

        const liveModels = modelsData?.data ?? [];
        const byProvider = new Map<string, { id: string; name: string; providerId: string }[]>();
        for (const m of liveModels) {
            let providerId = "custom";
            let modelId = m.id;
            if (m.id.includes("/")) {
                const parts = m.id.split("/");
                providerId = parts[0] || "custom";
                modelId = parts.slice(1).join("/");
            }
            const fullId = m.id.includes("/") ? m.id : `${providerId}/${m.id}`;
            if (!byProvider.has(providerId)) byProvider.set(providerId, []);
            byProvider.get(providerId)!.push({ id: fullId, name: modelId.replace(/[-_]/g, " "), providerId });
        }
        for (const [pid, items] of byProvider) {
            const kp = KNOWN_PROVIDERS.find((p) => p.id === pid || p.alias === pid);
            result.push({ label: kp?.name ?? pid.toUpperCase(), icon: <ProviderIcon providerId={pid} className="size-3.5" />, items });
        }
        return result;
    }, [combos, modelsData]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return groups;
        return groups.map((g) => ({ ...g, items: g.items.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)) })).filter((g) => g.items.length > 0);
    }, [groups, search]);

    return (
        <Dropdown open={open} onClose={() => { setOpen(false); setSearch(""); }} trigger={
            <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:border-primary/50 cursor-pointer">
                <span className="truncate">{value || "Select model…"}</span>
                <ChevronDown className={`size-3.5 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
        }>
            <div className="p-2">
                <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-muted" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full rounded-lg border border-border bg-background pl-8 pr-2 py-1.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono" autoFocus />
                </div>
                <div className="space-y-2">
                    {filtered.length === 0 && <div className="py-4 text-center text-xs text-text-muted">No models found</div>}
                    {filtered.map((g) => (
                        <div key={g.label}>
                            <div className="flex items-center gap-1.5 px-1 mb-1 text-[10px] font-semibold text-text-muted">{g.icon}<span>{g.label}</span></div>
                            <div className="space-y-0.5">
                                {g.items.map((m) => (
                                    <button key={m.id} type="button" onClick={() => { onChange(m.id); setOpen(false); setSearch(""); }} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer ${value === m.id ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-surface"}`}>
                                        {m.isCombo ? <Layers className="size-3 text-cyan-500 shrink-0" /> : <ProviderIcon providerId={m.providerId} className="size-3" />}
                                        <span className="truncate">{m.name}</span>
                                        {value === m.id && <Check className="size-3 ml-auto shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Dropdown>
    );
}

/* ─── API Key Selector ────────────────────────────────────────────── */

function ApiKeySelector({
    value,
    onChange,
    keys
}: {
    value: string;
    onChange: (v: string) => void;
    keys: APIKeyZod[];
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return keys;
        return keys.filter((k) => k.name.toLowerCase().includes(q) || k.key.toLowerCase().includes(q));
    }, [keys, search]);

    const selected = keys.find((k) => k.key === value);

    return (
        <Dropdown open={open} onClose={() => { setOpen(false); setSearch(""); }} trigger={
            <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:border-primary/50 cursor-pointer">
                <span className="truncate flex items-center gap-1.5"><KeyRound className="size-3 text-amber-500 shrink-0" />{selected?.name || "Select API key…"}</span>
                <ChevronDown className={`size-3.5 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
        }>
            <div className="p-2">
                <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-muted" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full rounded-lg border border-border bg-background pl-8 pr-2 py-1.5 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono" autoFocus />
                </div>
                <div className="space-y-0.5">
                    {filtered.length === 0 && <div className="py-4 text-center text-xs text-text-muted">No keys</div>}
                    {filtered.map((k) => (
                        <button key={k.id} type="button" onClick={() => { onChange(k.key); setOpen(false); setSearch(""); }} className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer ${value === k.key ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-surface"}`}>
                            <span className="flex items-center gap-2 min-w-0"><KeyRound className="size-3 shrink-0" /><span className="truncate">{k.name}</span></span>
                            {value === k.key && <Check className="size-3" />}
                        </button>
                    ))}
                </div>
            </div>
        </Dropdown>
    );
}

/* ─── Tool Icon ───────────────────────────────────────────────────── */

function ToolIcon({ tool, size = 32 }: { tool: CLIToolDef; size?: number }) {
    const [imgError, setImgError] = useState(false);

    if (tool.image && !imgError) {
        return (
            <img
                src={tool.image}
                alt={tool.name}
                width={size}
                height={size}
                className="size-8 object-contain rounded-lg shrink-0"
                onError={() => setImgError(true)}
                loading="lazy"
                decoding="async"
            />
        );
    }

    return (
        <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold text-white"
            style={{ backgroundColor: tool.color }}
        >
            {tool.icon}
        </div>
    );
}

/* ─── Tool Card ───────────────────────────────────────────────────── */

function ToolCard({
    tool,
    baseUrl,
    apiKey,
    model,
    combos,
    modelsData,
    keys
}: {
    tool: CLIToolDef;
    baseUrl: string;
    apiKey: string;
    model: string;
    combos: FallbackRule[];
    modelsData: ModelListResponse | undefined;
    keys: APIKeyZod[];
}) {
    const [expanded, setExpanded] = useState(false);
    const [localModel, setLocalModel] = useState(model);
    const [localKey, setLocalKey] = useState(apiKey);
    const { copied, copy } = useCopy();

    const configObj = getToolConfig(tool.id, baseUrl, localKey || "YOUR_API_KEY", localModel);
    const configJson = JSON.stringify(configObj, null, 2);

    return (
        <div className={`rounded-xl border overflow-hidden transition-colors ${expanded ? "border-primary/50 bg-card" : "border-border/80 bg-card/60 hover:border-primary/30"}`}>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setExpanded(!expanded)}>
                <div className="flex min-w-0 items-center gap-3">
                    <ToolIcon tool={tool} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm text-foreground">{tool.name}</h3>
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">Ready</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                    </div>
                </div>
                <ChevronDown className={`size-5 text-muted-foreground transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
            </div>

            {/* Expanded */}
            {expanded && (
                <div className="border-t border-border/50 p-4 space-y-3">
                    {/* Endpoint */}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[7rem_1fr] sm:items-center sm:gap-3">
                        <span className="text-xs font-semibold text-foreground sm:text-right">Endpoint</span>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 min-w-0 truncate rounded bg-surface/40 px-2 py-1.5 text-xs text-muted-foreground font-mono">{baseUrl}</code>
                            <button type="button" onClick={() => void copy(baseUrl, "Endpoint copied")} className="shrink-0 rounded border border-border/60 bg-surface px-2 py-1.5 text-xs hover:bg-muted/40 transition-colors cursor-pointer">
                                {copied === baseUrl ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                            </button>
                        </div>
                    </div>

                    {/* API Key */}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[7rem_1fr] sm:items-center sm:gap-3">
                        <span className="text-xs font-semibold text-foreground sm:text-right">API Key</span>
                        <ApiKeySelector value={localKey} onChange={setLocalKey} keys={keys} />
                    </div>

                    {/* Model */}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[7rem_1fr] sm:items-center sm:gap-3">
                        <span className="text-xs font-semibold text-foreground sm:text-right">Model</span>
                        <ModelSelector value={localModel} onChange={setLocalModel} combos={combos} modelsData={modelsData} />
                    </div>

                    {/* Config Preview */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                <FileJson className="size-3.5 text-muted-foreground" />
                                {tool.configPaths.map((p) => (
                                    <span key={p} className="rounded bg-surface/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{p}</span>
                                ))}
                            </div>
                            <button type="button" onClick={() => void copy(configJson, `${tool.name} config copied`)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer">
                                {copied === configJson ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                                <span>{copied === configJson ? "Copied!" : "Copy"}</span>
                            </button>
                        </div>
                        <pre className="rounded-lg border border-border/60 bg-black/5 dark:bg-white/5 p-3 overflow-x-auto text-xs leading-relaxed font-mono text-foreground max-h-48 overflow-y-auto">
                            <code>{configJson}</code>
                        </pre>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                        <Button variant="outline" size="sm" className="text-xs h-7 cursor-pointer" onClick={() => void copy(configJson, `${tool.name} config copied`)}>
                            <Copy className="size-3 mr-1" />Copy Config
                        </Button>
                        {tool.installCmd && (
                            <Button variant="ghost" size="sm" className="text-xs h-7 cursor-pointer" onClick={() => void copy(tool.installCmd, "Install command copied")}>
                                <Terminal className="size-3 mr-1" />Install
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Main Page ───────────────────────────────────────────────────── */

export function CLIToolsCard() {
    const [selectedModel, setSelectedModel] = useState("anthropic/claude-sonnet-4-20250514");
    const [selectedKey, setSelectedKey] = useState("");

    const { fallbacks } = useFallbacks();
    const { data: modelsData } = useQuery({ queryKey: ["models"], queryFn: () => api.get<ModelListResponse>("/v1/models"), staleTime: 60_000 });
    const { data: keysData } = useQuery({ queryKey: ["keys"], queryFn: () => api.get<{ data: APIKeyZod[] }>("/v1/keys"), staleTime: 30_000 });

    const keys = useMemo(() => (keysData?.data ?? []).filter((k) => k.enabled), [keysData]);
    const combos = useMemo(() => fallbacks.filter((f) => f.enabled), [fallbacks]);

    const baseUrl = (() => {
        if (import.meta.env.VITE_API_BASE_URL) return (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, "");
        if (import.meta.env.VITE_API_URL) { const b = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, ""); return b.endsWith("/v1") ? b : `${b}/v1`; }
        if (typeof window !== "undefined") {
            const { hostname, protocol, port, origin } = window.location;
            if (import.meta.env.DEV || port === "5173" || port === "5174") { const bp = (import.meta.env.VITE_BACKEND_PORT as string) || "3000"; return `${protocol}//${hostname}:${bp}/v1`; }
            return `${origin}/v1`;
        }
        return "http://localhost:3000/v1";
    })();

    const activeKey = keys.find((k) => k.key === selectedKey) ?? keys[0];
    const apiKey = activeKey?.key ?? "";

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 font-mono">
            {/* Grid of tool cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {CLI_TOOLS.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} baseUrl={baseUrl} apiKey={apiKey} model={selectedModel} combos={combos} modelsData={modelsData} keys={keys} />
                ))}
            </div>

            {/* Global selectors below */}
            <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex items-center gap-2 px-1">
                    <Terminal className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Gateway Connection</h2>
                </div>
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 space-y-3 shadow-2xs">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Base URL</label>
                            <code className="block w-full rounded-lg border border-border/60 bg-surface px-2.5 py-1.5 text-xs text-foreground font-mono truncate">{baseUrl}</code>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model</label>
                            <ModelSelector value={selectedModel} onChange={setSelectedModel} combos={combos} modelsData={modelsData} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">API Key</label>
                            <ApiKeySelector value={selectedKey} onChange={setSelectedKey} keys={keys} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
