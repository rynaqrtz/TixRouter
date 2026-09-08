import { useEffect, useMemo, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
    Boxes,
    Brain,
    Coins,
    Cpu,
    Gauge,
    GitFork,
    KeyRound,
    LayoutDashboard,
    ScrollText,
    Settings,
    Sparkles,
    Zap
} from "lucide-react";

interface CommandItem {
    id: string;
    label: string;
    hint?: string;
    icon: typeof Zap;
    action: () => void;
}

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const navigate = useNavigate();
    const { invalidate } = useRouter();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            }
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const commands = useMemo<CommandItem[]>(() => {
        return [
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, action: () => { void navigate({ to: "/" }); setOpen(false); } },
            { id: "keys", label: "API Keys", icon: KeyRound, action: () => { void navigate({ to: "/keys" }); setOpen(false); } },
            { id: "analytics", label: "Analytics", icon: Zap, action: () => { void navigate({ to: "/analytics" }); setOpen(false); } },
            { id: "playground", label: "Playground", icon: Sparkles, action: () => { void navigate({ to: "/playground" }); setOpen(false); } },
            { id: "providers", label: "Providers", icon: Boxes, action: () => { void navigate({ to: "/providers" }); setOpen(false); } },
            { id: "combo", label: "Combo", icon: GitFork, action: () => { void navigate({ to: "/combo" }); setOpen(false); } },
            { id: "token-saver", label: "Token Saver", icon: Coins, action: () => { void navigate({ to: "/token-saver" }); setOpen(false); } },
            { id: "quota", label: "Quotas & Limits", icon: Gauge, action: () => { void navigate({ to: "/quota" }); setOpen(false); } },
            { id: "routing", label: "Routing Health", icon: Brain, action: () => { void navigate({ to: "/routing" }); setOpen(false); } },
            { id: "logs", label: "Audit Logs", icon: ScrollText, action: () => { void navigate({ to: "/logs" }); setOpen(false); } },
            { id: "settings", label: "Settings & Ops", icon: Settings, action: () => { void navigate({ to: "/settings" }); setOpen(false); } },
            { id: "cli-tools", label: "CLI Tools", icon: Cpu, action: () => { void navigate({ to: "/cli-tools" }); setOpen(false); } },
            {
                id: "refresh",
                label: "Refresh gateway data",
                hint: "Invalidate all queries",
                icon: Zap,
                action: () => {
                    void invalidate();
                    setOpen(false);
                }
            }
        ];
    }, [navigate, invalidate]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return commands;
        return commands.filter(
            (c) => c.label.toLowerCase().includes(q) || (c.hint ?? "").toLowerCase().includes(q)
        );
    }, [commands, query]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-xs pt-[20vh] font-mono"
            onClick={() => setOpen(false)}
        >
            <div
                className="w-full max-w-md rounded-xl border border-border/80 bg-card shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search pages and actions…"
                    className="w-full border-b border-border/60 bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <div className="max-h-80 overflow-y-auto p-1.5">
                    {filtered.length === 0 && (
                        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                            No matches for “{query}”
                        </p>
                    )}
                    {filtered.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={c.action}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
                        >
                            <c.icon className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="font-semibold">{c.label}</span>
                            {c.hint && <span className="ml-auto text-[10px] text-muted-foreground">{c.hint}</span>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}