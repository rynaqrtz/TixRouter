import { Server, Clock, RefreshCw, Zap, Layers } from "lucide-react";
import type { AppSettings } from "@/hooks/useSettings";
import { Switch } from "@/components/ui/switch";

interface GatewaySettingsProps {
    settings: AppSettings;
    updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function GatewaySettings({ settings, updateSetting }: GatewaySettingsProps) {
    return (
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-6 shadow-2xs">
            <div>
                <div className="flex items-center gap-2">
                    <Server className="size-4 text-foreground" />
                    <h2 className="text-sm font-bold text-foreground tracking-tight">
                        Gateway & Proxy Configuration
                    </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Configure upstream connection limits, timeout windows, and automatic rate-limit
                    failover mechanics.
                </p>
            </div>

            {/* Global Request Timeout */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Clock className="size-3.5 text-muted-foreground" />
                            <span>Upstream Request Timeout</span>
                        </label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Maximum duration the gateway will wait for upstream LLM streaming
                            responses before aborting.
                        </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-foreground tabular-nums px-2 py-0.5 rounded bg-muted/60 border border-border/60">
                        {settings.requestTimeoutSec}s
                    </span>
                </div>

                <div className="inline-flex items-center rounded-lg border border-border/80 bg-muted/40 p-1 font-mono gap-1">
                    {[30, 60, 120, 180, 300].map((sec) => {
                        const isActive = settings.requestTimeoutSec === sec;
                        return (
                            <button
                                key={sec}
                                type="button"
                                onClick={() => updateSetting("requestTimeoutSec", sec)}
                                className={`rounded-md px-3 py-1.5 text-xs tabular-nums font-semibold transition-all cursor-pointer ${
                                    isActive
                                        ? "bg-background text-foreground shadow-xs border border-border/80 font-bold"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                                }`}
                            >
                                {sec}s
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Auto Retry on Rate Limit (HTTP 429) */}
            <div className="space-y-3 pt-5 border-t border-border/70">
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <RefreshCw className="size-3.5 text-muted-foreground" />
                            <span>Auto-Retry on Rate Limit (HTTP 429)</span>
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                            Automatically retry failed upstream requests with exponential backoff
                            when provider quotas trigger 429 errors.
                        </p>
                    </div>
                    <Switch
                        checked={settings.autoRetryOn429}
                        onCheckedChange={(val) => updateSetting("autoRetryOn429", val)}
                    />
                </div>

                {settings.autoRetryOn429 && (
                    <div className="rounded-lg border border-border/70 bg-muted/20 divide-y divide-border/60">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5">
                            <div className="space-y-0.5">
                                <div className="text-xs font-semibold text-foreground">
                                    Maximum Retry Attempts
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    Number of sequential retry attempts before reporting failure.
                                </div>
                            </div>
                            <div className="inline-flex items-center rounded-lg border border-border/80 bg-background/80 p-0.5 font-mono gap-1 self-start sm:self-auto">
                                {[1, 2, 3, 5].map((retries) => {
                                    const isActive = settings.maxRetries === retries;
                                    return (
                                        <button
                                            key={retries}
                                            type="button"
                                            onClick={() => updateSetting("maxRetries", retries)}
                                            className={`rounded-md px-2.5 py-1 text-xs tabular-nums font-semibold transition-all cursor-pointer ${
                                                isActive
                                                    ? "bg-foreground text-background shadow-xs font-bold"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {retries}x
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5">
                            <div className="space-y-0.5">
                                <div className="text-xs font-semibold text-foreground">
                                    Base Backoff Delay
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    Initial exponential sleep duration before the first retry
                                    attempt.
                                </div>
                            </div>
                            <div className="inline-flex items-center rounded-lg border border-border/80 bg-background/80 p-0.5 font-mono gap-1 self-start sm:self-auto">
                                {[500, 1000, 2000].map((ms) => {
                                    const isActive = settings.retryDelayMs === ms;
                                    return (
                                        <button
                                            key={ms}
                                            type="button"
                                            onClick={() => updateSetting("retryDelayMs", ms)}
                                            className={`rounded-md px-2.5 py-1 text-xs tabular-nums font-semibold transition-all cursor-pointer ${
                                                isActive
                                                    ? "bg-foreground text-background shadow-xs font-bold"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {ms}ms
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Token Refresh Lead Time */}
            <div className="space-y-3 pt-5 border-t border-border/70">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Zap className="size-3.5 text-foreground" />
                            <span>OAuth Token Refresh Lead Time</span>
                        </label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Proactively renew provider OAuth tokens before expiry to ensure zero
                            request disruption.
                        </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-foreground tabular-nums px-2 py-0.5 rounded bg-muted/60 border border-border/60">
                        {settings.tokenRefreshLeadMin} min
                    </span>
                </div>

                <div className="inline-flex items-center rounded-lg border border-border/80 bg-muted/40 p-1 font-mono gap-1">
                    {[2, 5, 10, 15].map((min) => {
                        const isActive = settings.tokenRefreshLeadMin === min;
                        return (
                            <button
                                key={min}
                                type="button"
                                onClick={() => updateSetting("tokenRefreshLeadMin", min)}
                                className={`rounded-md px-3 py-1.5 text-xs tabular-nums font-semibold transition-all cursor-pointer ${
                                    isActive
                                        ? "bg-background text-foreground shadow-xs border border-border/80 font-bold"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                                }`}
                            >
                                {min} min
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Architecture Info Banner */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 flex items-start gap-3">
                <Layers className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Transparent Protocol Streaming:</strong> All
                    downstream clients receive raw Server-Sent Events (SSE) chunks immediately as
                    upstream providers output tokens, minimizing time-to-first-token (TTFT) without
                    proxy buffering overhead.
                </div>
            </div>
        </div>
    );
}
