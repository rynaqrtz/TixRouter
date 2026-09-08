import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Brain, DatabaseZap, RefreshCw, Swords, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/routing")({
    staticData: { title: "Routing Health" },
    component: RoutingPage
});

interface OutcomeRow {
    model: string;
    total: number;
    successes: number;
    retries: number;
    failures: number;
    score: number;
}

interface AffinityRow {
    providerId: string;
    model: string;
    cacheHits: number;
    totalRequests: number;
    cachedTokens: number;
}

interface RoutingResponse {
    outcome: OutcomeRow[];
    cacheAffinity: AffinityRow[];
}

interface ArenaStatsRow {
    candidate_model: string;
    trials: number;
    wins: number;
    win_rate: number;
    avg_latency_ms: number;
    total_cost: number;
}

interface ArenaResponse {
    stats: ArenaStatsRow[];
}

function ScoreBar({ score }: { score: number }) {
    const pct = Math.round(score * 100);
    const color = score >= 0.8 ? "bg-emerald-500" : score >= 0.5 ? "bg-amber-500" : "bg-rose-500";
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular-nums text-[11px] font-semibold text-foreground">{pct}</span>
        </div>
    );
}

function RoutingPage() {
    const { data, isPending, error, refetch } = useQuery({
        queryKey: ["routing_stats"],
        queryFn: () => api.get<RoutingResponse>("/v1/logs/routing"),
        refetchInterval: 30_000
    });
    const { data: arenaData } = useQuery({
        queryKey: ["arena_stats"],
        queryFn: () => api.get<ArenaResponse>("/v1/settings/arena")
    });

    if (isPending) {
        return (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 font-mono">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="mx-auto w-full max-w-6xl font-mono">
                <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 text-center">
                    <TriangleAlert className="size-6 text-destructive mb-3" />
                    <h1 className="text-sm font-bold text-foreground">Unable to load routing stats</h1>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {error instanceof Error ? error.message : "Unknown error"}
                    </p>
                    <Button type="button" variant="outline" size="sm" className="mt-4 h-8 text-xs cursor-pointer" onClick={() => void refetch()}>
                        <RefreshCw className="size-3" />
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    const { outcome, cacheAffinity } = data;
    const trials = arenaData?.stats ?? [];

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 font-mono">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end border-b border-border/80 pb-5">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                        Intelligence Layer
                    </p>
                    <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">Routing Health</h1>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                        Outcome scores that reorder fallback candidates, prefix-cache affinity per provider, and Shadow Arena trials.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs cursor-pointer gap-1.5"
                    onClick={() => void refetch()}
                >
                    <RefreshCw className="size-3.5" />
                    Refresh
                </Button>
            </header>

            <section className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                <div className="flex items-center gap-2 mb-3">
                    <Brain className="size-4 text-muted-foreground" />
                    <h2 className="text-xs font-bold text-foreground">Outcome-Feedback Scores</h2>
                    <span className="text-[10px] text-muted-foreground ml-auto">14-day window · Wilson lower bound</span>
                </div>
                {outcome.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border/60 rounded-lg">
                        No traffic yet. Scores appear after requests flow through the gateway.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground">
                                    <th className="py-2 pr-3">Model</th>
                                    <th className="py-2 pr-3 text-right">Requests</th>
                                    <th className="py-2 pr-3 text-right">Success</th>
                                    <th className="py-2 pr-3 text-right">Retries</th>
                                    <th className="py-2 pr-3 text-right">Failures</th>
                                    <th className="py-2 text-right">Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {outcome.map((row) => (
                                    <tr key={row.model}>
                                        <td className="py-2 pr-3 font-mono text-foreground truncate max-w-xs">{row.model}</td>
                                        <td className="py-2 pr-3 text-right tabular-nums">{row.total}</td>
                                        <td className="py-2 pr-3 text-right tabular-nums text-emerald-500">{row.successes}</td>
                                        <td className="py-2 pr-3 text-right tabular-nums text-amber-500">{row.retries}</td>
                                        <td className="py-2 pr-3 text-right tabular-nums text-rose-500">{row.failures}</td>
                                        <td className="py-2">
                                            <div className="flex justify-end">
                                                <ScoreBar score={row.score} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                <div className="flex items-center gap-2 mb-3">
                    <DatabaseZap className="size-4 text-muted-foreground" />
                    <h2 className="text-xs font-bold text-foreground">Prefix-Cache Affinity</h2>
                    <span className="text-[10px] text-muted-foreground ml-auto">7-day window · per provider</span>
                </div>
                {cacheAffinity.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border/60 rounded-lg">
                        No cached tokens recorded yet.
                    </p>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                        {cacheAffinity.slice(0, 12).map((row) => (
                            <div key={`${row.providerId}-${row.model}`} className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[11px] font-semibold text-foreground truncate">{row.model}</span>
                                    <span className="text-[10px] text-muted-foreground shrink-0">{row.providerId}</span>
                                </div>
                                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                                    <span>
                                        cache hits <span className="font-semibold text-emerald-500">{row.cacheHits}</span> / {row.totalRequests}
                                    </span>
                                    <span>
                                        {row.cachedTokens.toLocaleString()} cached tokens
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                <div className="flex items-center gap-2 mb-3">
                    <Swords className="size-4 text-muted-foreground" />
                    <h2 className="text-xs font-bold text-foreground">Shadow Arena Trials</h2>
                    <span className="text-[10px] text-muted-foreground ml-auto">{trials.length} recorded</span>
                </div>
                {trials.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border/60 rounded-lg">
                        No arena trials yet. Enable mirror sampling in settings to start comparing candidate models.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground">
                                    <th className="py-2 pr-3">Candidate Model</th>
                                    <th className="py-2 pr-3 text-right">Trials</th>
                                    <th className="py-2 pr-3 text-right">Wins</th>
                                    <th className="py-2 pr-3 text-right">Win Rate</th>
                                    <th className="py-2 pr-3 text-right">Avg Latency</th>
                                    <th className="py-2 text-right">Total Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {trials.map((t) => (
                                    <tr key={t.candidate_model}>
                                        <td className="py-2 pr-3 font-mono text-foreground truncate max-w-[14rem]">{t.candidate_model}</td>
                                        <td className="py-2 pr-3 text-right tabular-nums">{t.trials}</td>
                                        <td className="py-2 pr-3 text-right tabular-nums text-emerald-500">{t.wins}</td>
                                        <td className="py-2 pr-3 text-right tabular-nums font-semibold text-foreground">{t.win_rate}%</td>
                                        <td className="py-2 pr-3 text-right tabular-nums">{t.avg_latency_ms}ms</td>
                                        <td className="py-2 text-right tabular-nums text-emerald-500">${t.total_cost.toFixed(4)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}