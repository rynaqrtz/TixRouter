import { Shield, Database, Coins, Lock, Check } from "lucide-react";
import type { AppSettings } from "@/hooks/useSettings";
import { Switch } from "@/components/ui/switch";

interface LoggingSettingsProps {
    settings: AppSettings;
    updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function LoggingSettings({ settings, updateSetting }: LoggingSettingsProps) {
    const loggingOptions = [
        {
            id: "full",
            title: "Full Payload",
            badge: "Recommended",
            badgeColor: "bg-muted text-foreground border-border/80",
            desc: "Store full prompt messages and completion responses for inspection in the Logs view."
        },
        {
            id: "metadata",
            title: "Metadata Only",
            badge: "Privacy Focused",
            badgeColor: "bg-muted text-muted-foreground border-border/80",
            desc: "Log only timestamps, model IDs, token usage, and latency. Message contents are discarded."
        },
        {
            id: "disabled",
            title: "Disabled",
            badge: "Zero Trace",
            badgeColor: "bg-muted text-muted-foreground border-border/80",
            desc: "Do not record any request logs to SQLite database. Quota and tokens are still calculated."
        }
    ] as const;

    return (
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-6 shadow-2xs">
            <div>
                <div className="flex items-center gap-2">
                    <Shield className="size-4 text-foreground" />
                    <h2 className="text-sm font-bold text-foreground tracking-tight">
                        Logging, Privacy & Audit
                    </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Control data retention policies and request payload logging granularity stored
                    in SQLite.
                </p>
            </div>

            {/* Logging Level */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-foreground">
                    Request Payload Logging Level
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {loggingOptions.map(({ id, title, badge, badgeColor, desc }) => {
                        const isSelected = settings.loggingLevel === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => updateSetting("loggingLevel", id)}
                                className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer ${
                                    isSelected
                                        ? "border-foreground bg-muted/60 text-foreground ring-1 ring-foreground/20 shadow-xs"
                                        : "border-border/80 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-xs font-bold text-foreground">
                                        {title}
                                    </span>
                                    {isSelected ? (
                                        <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-background">
                                            <Check className="size-2.5 stroke-[3]" />
                                        </span>
                                    ) : (
                                        <span
                                            className={`text-[9.5px] font-semibold uppercase px-1.5 py-0.2 rounded border ${badgeColor}`}
                                        >
                                            {badge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    {desc}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Log Retention Policy */}
            <div className="space-y-3 pt-5 border-t border-border/70">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Database className="size-3.5 text-muted-foreground" />
                            <span>SQLite Log Retention Window</span>
                        </label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Audit logs older than this threshold will be pruned automatically to
                            conserve disk space.
                        </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-foreground tabular-nums px-2 py-0.5 rounded bg-muted/60 border border-border/60">
                        {settings.logRetentionDays === 365
                            ? "1 Year"
                            : `${settings.logRetentionDays} Days`}
                    </span>
                </div>

                <div className="inline-flex items-center rounded-lg border border-border/80 bg-muted/40 p-1 font-mono gap-1">
                    {[7, 14, 30, 90, 365].map((days) => {
                        const isActive = settings.logRetentionDays === days;
                        return (
                            <button
                                key={days}
                                type="button"
                                onClick={() => updateSetting("logRetentionDays", days)}
                                className={`rounded-md px-3 py-1.5 text-xs tabular-nums font-semibold transition-all cursor-pointer ${
                                    isActive
                                        ? "bg-background text-foreground shadow-xs border border-border/80 font-bold"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                                }`}
                            >
                                {days === 365 ? "1 Year" : `${days}d`}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Additional Privacy Switches */}
            <div className="space-y-3 pt-5 border-t border-border/70">
                <label className="text-xs font-bold text-foreground">
                    Telemetry & Privacy Controls
                </label>

                <div className="rounded-lg border border-border/70 bg-muted/20 divide-y divide-border/60">
                    {/* Record token usage */}
                    <div className="flex items-center justify-between p-3.5 gap-4">
                        <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Coins className="size-3.5 text-muted-foreground" />
                                <span>Record Token Usage & Pricing Estimates</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Aggregate prompt and completion tokens to calculate cost estimates
                                on the Dashboard.
                            </p>
                        </div>
                        <Switch
                            checked={settings.recordTokenUsage}
                            onCheckedChange={(val) => updateSetting("recordTokenUsage", val)}
                        />
                    </div>

                    {/* Mask sensitive headers */}
                    <div className="flex items-center justify-between p-3.5 gap-4">
                        <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Lock className="size-3.5 text-muted-foreground" />
                                <span>Mask Sensitive Auth Headers in Logs</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Automatically redact Authorization tokens and provider credentials
                                in database records.
                            </p>
                        </div>
                        <Switch
                            checked={settings.maskSensitiveHeaders}
                            onCheckedChange={(val) => updateSetting("maskSensitiveHeaders", val)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
