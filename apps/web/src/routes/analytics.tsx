import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, RefreshCw, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { formatCompactNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnalyticsSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/analytics")({
    staticData: { title: "Analytics" },
    component: AnalyticsPage
});

interface AnalyticsPoint {
    date: string;
    requests: number;
    tokens: number;
    cost: number;
    cachedTokens: number;
}

interface TopClientRow {
    apiKeyId: string;
    name: string | null;
    requests: number;
    tokens: number;
    cost: number;
}

interface AnalyticsResponse {
    timeseries: AnalyticsPoint[];
    topClients: TopClientRow[];
    errorRate: { requests: number; errors: number; errorRate: number };
    byModel: Array<{ model: string; totalRequests: number; estCost: number }>;
}

function Bars({ points, valueOf, format }: { points: AnalyticsPoint[]; valueOf: (p: AnalyticsPoint) => number; format: (n: number) => string }) {
    const max = Math.max(1, ...points.map(valueOf));
    return (
        <div className="flex items-end gap-1.5 h-40">
            {points.map((p) => {
                const v = valueOf(p);
                const h = Math.max(4, Math.round((v / max) * 100));
                return (
                    <div key={p.date} className="flex-1 flex flex-col items-center gap-1 group">
                        <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            {format(v)}
                        </span>
                        <div
                            className="w-full rounded-sm bg-foreground/80 group-hover:bg-amber-500 transition-colors"
                            style={{ height: `${h}px` }}
                            title={`${p.date}: ${format(v)}`}
                        />
                        <span className="text-[8px] text-muted-foreground/70 truncate w-full text-center">
                            {p.date.slice(5)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function AnalyticsPage() {
    const [days, setDays] = useState(14);
    const { data, isPending, error, refetch } = useQuery({
        queryKey: ["analytics", days],
        queryFn: () => api.get<AnalyticsResponse>(`/v1/logs/analytics?days=${days}`)
    });

    if (isPending || !data) {
        if (!data && error) {
            return (
                <div className="mx-auto w-full max-w-6xl font-mono">
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 text-center">
                        <TriangleAlert className="size-6 text-destructive mb-3" />
                        <h1 className="text-sm font-bold text-foreground">Unable to load analytics</h1>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {error instanceof Error ? error.message : "Unknown error"}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-4 h-8 text-xs cursor-pointer"
                            onClick={() => void refetch()}
                        >
                            <RefreshCw className="size-3" />
                            Retry
                        </Button>
                    </div>
                </div>
            );
        }
        return <AnalyticsSkeleton />;
    }

    const { timeseries, topClients, errorRate, byModel } = data;
    const totalCost = timeseries.reduce((s, p) => s + p.cost, 0);
    const totalTokens = timeseries.reduce((s, p) => s + p.tokens, 0);
    const totalCached = timeseries.reduce((s, p) => s + p.cachedTokens, 0);
    const cachePct = totalTokens > 0 ? (totalCached / totalTokens) * 100 : 0;

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 font-mono">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end border-b border-border/80 pb-5">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                        Insights & Trends
                    </p>
                    <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                        Cost, token, and cache trends across the gateway plus top consuming clients.
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    {[7, 14, 30, 90].map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => setDays(d)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                days === d
                                    ? "bg-foreground text-background"
                                    : "bg-secondary/30 text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </header>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Estimated Cost</span>
                        <BarChart3 className="size-3.5" />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-foreground">${totalCost.toFixed(4)}</div>
                </div>
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Tokens Routed</span>
                        <Activity className="size-3.5" />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-foreground">{formatCompactNumber(totalTokens)}</div>
                </div>
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Cache Hit Rate</span>
                        <ArrowDownRight className="size-3.5 text-emerald-500" />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-foreground">{cachePct.toFixed(1)}%</div>
                    <p className="text-[10px] text-muted-foreground">{formatCompactNumber(totalCached)} cached tokens</p>
                </div>
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">Error Rate Today</span>
                        <ArrowUpRight className="size-3.5 text-rose-500" />
                    </div>
                    <div className="mt-2 text-2xl font-bold text-foreground">{(errorRate.errorRate * 100).toFixed(1)}%</div>
                    <p className="text-[10px] text-muted-foreground">
                        {errorRate.errors} / {errorRate.requests} requests
                    </p>
                </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <h2 className="text-xs font-bold text-foreground mb-4">Tokens per day</h2>
                    <Bars points={timeseries} valueOf={(p) => p.tokens} format={formatCompactNumber} />
                </div>
                <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <h2 className="text-xs font-bold text-foreground mb-4">Requests per day</h2>
                    <Bars points={timeseries} valueOf={(p) => p.requests} format={(n) => String(n)} />
                </div>
            </section>

            {topClients.length > 0 && (
                <section className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <h2 className="text-xs font-bold text-foreground mb-3">Top clients</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-border/60 text-[10px] uppercase font-bold text-muted-foreground">
                                    <th className="py-2 pr-3">Key</th>
                                    <th className="py-2 pr-3 text-right">Requests</th>
                                    <th className="py-2 pr-3 text-right">Tokens</th>
                                    <th className="py-2 text-right">Cost</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {topClients.map((c) => (
                                    <tr key={c.apiKeyId}>
                                        <td className="py-2 pr-3 font-mono text-foreground">
                                            {c.name ?? c.apiKeyId}
                                        </td>
                                        <td className="py-2 pr-3 text-right tabular-nums">{c.requests}</td>
                                        <td className="py-2 pr-3 text-right tabular-nums">{formatCompactNumber(c.tokens)}</td>
                                        <td className="py-2 text-right tabular-nums text-emerald-500">${c.cost.toFixed(4)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {byModel.length > 0 && (
                <section className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-2xs">
                    <h2 className="text-xs font-bold text-foreground mb-3">Top models</h2>
                    <div className="flex flex-wrap gap-1.5">
                        {byModel.slice(0, 12).map((m) => (
                            <span
                                key={m.model}
                                className="rounded-md border border-border/60 bg-secondary/30 px-2 py-1 text-[10px] font-mono text-foreground"
                                title={`${m.totalRequests} requests · $${m.estCost.toFixed(4)}`}
                            >
                                {m.model}
                                <span className="text-muted-foreground ml-1.5">×{m.totalRequests}</span>
                            </span>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}