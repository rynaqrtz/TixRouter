import { useState } from "react";
import { RefreshCw, AlertCircle, Info, Database } from "lucide-react";
import { ProviderIcon } from "@/components/ProviderIcon";
import { Badge } from "@/components/ui/badge";
import QuotaProgressBar from "./QuotaProgressBar";

interface QuotaItem {
    name: string;
    used: number;
    total: number;
    resetAt?: string | null;
    remainingPercentage?: number;
    recurring?: boolean;
}

interface ProviderLimitCardProps {
    provider: string;
    name?: string;
    plan?: string;
    quotas?: QuotaItem[];
    message?: string | null;
    loading?: boolean;
    error?: string | null;
    onRefresh?: () => Promise<void>;
}

export default function ProviderLimitCard({
    provider,
    name,
    plan,
    quotas = [],
    message = null,
    loading = false,
    error = null,
    onRefresh
}: ProviderLimitCardProps) {
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (!onRefresh || refreshing) return;
        setRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setRefreshing(false);
        }
    };

    return (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4 font-mono shadow-2xs">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg border border-border/80 bg-secondary/50 p-1.5 flex items-center justify-center shrink-0">
                        <ProviderIcon providerId={provider} className="size-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground text-sm">{name || provider}</h3>
                        {plan && (
                            <Badge variant="outline" className="text-[10px] uppercase mt-0.5">
                                {plan}
                            </Badge>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={refreshing || loading}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                    title="Refresh quota"
                >
                    <RefreshCw className={`size-4 ${refreshing || loading ? "animate-spin text-amber-500" : ""}`} />
                </button>
            </div>

            {/* Loading */}
            {loading && (
                <div className="space-y-3 py-2">
                    <div className="h-3 bg-muted/60 rounded animate-pulse w-3/4" />
                    <div className="h-1.5 bg-muted/60 rounded animate-pulse" />
                    <div className="h-3 bg-muted/60 rounded animate-pulse w-1/2" />
                </div>
            )}

            {/* Error */}
            {!loading && error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-destructive text-xs">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <p>{error}</p>
                </div>
            )}

            {/* Message */}
            {!loading && !error && message && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-2 text-blue-500 text-xs">
                    <Info className="size-4 shrink-0 mt-0.5" />
                    <p>{message}</p>
                </div>
            )}

            {/* Quotas */}
            {!loading && !error && !message && quotas.length > 0 && (
                <div className="space-y-3">
                    {quotas.map((quota, idx) => {
                        const percentage =
                            quota.remainingPercentage !== undefined
                                ? quota.remainingPercentage
                                : quota.total > 0
                                  ? Math.round(((quota.total - quota.used) / quota.total) * 100)
                                  : 100;
                        const unlimited = quota.total === 0 || quota.total === null;

                        return (
                            <QuotaProgressBar
                                key={`${quota.name}-${idx}`}
                                label={quota.name}
                                used={quota.used}
                                total={quota.total}
                                percentage={percentage}
                                unlimited={unlimited}
                                resetTime={quota.resetAt}
                                recurring={quota.recurring !== false}
                            />
                        );
                    })}
                </div>
            )}

            {/* Empty */}
            {!loading && !error && !message && quotas.length === 0 && (
                <div className="text-center py-6 text-muted-foreground flex flex-col items-center gap-1.5">
                    <Database className="size-8 opacity-30" />
                    <p className="text-xs">No quota data available</p>
                </div>
            )}
        </div>
    );
}
