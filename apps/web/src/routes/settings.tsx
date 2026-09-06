import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Cpu,
    Database,
    Download,
    KeyRound,
    Palette,
    RotateCcw,
    Server,
    Shield,
    ArrowUpCircle,
    Webhook,
    Zap,
    DatabaseZap
} from "lucide-react";
import { toast } from "sonner";
import { api, getGatewayBaseUrl } from "@/lib/api";
import { useTheme } from "@/context/Theme";
import { useSettings } from "@/hooks/useSettings";
import { useVersion } from "@/hooks/useVersion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { GatewaySettings } from "@/components/settings/GatewaySettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { LoggingSettings } from "@/components/settings/LoggingSettings";
import { DataSettings } from "@/components/settings/DataSettings";
import { SystemSettings } from "@/components/settings/SystemSettings";
import { SettingsSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/settings")({
    staticData: { title: "Settings" },
    component: SettingsPage
});

type SettingsTab = "security" | "gateway" | "appearance" | "logging" | "data" | "system";

interface ServerSettingsResponse {
    require_api_key?: boolean;
    requireApiKey?: boolean;
    settings?: Record<string, string>;
}

interface ServerFeatureFlags {
    free_tier_failover_enabled: boolean;
    cache_enabled: boolean;
    notify_webhook_url: string;
}

function ServerFeaturesCard() {
    const queryClient = useQueryClient();
    const { data, isPending } = useQuery<Record<string, string>>({
        queryKey: ["server_settings_raw"],
        queryFn: async () => {
            const res = await api.get<{ settings?: Record<string, string> }>("/v1/settings");
            return res.settings ?? {};
        }
    });
    const mutation = useMutation({
        mutationFn: (patch: Record<string, string>) => api.post("/v1/settings", { settings: patch }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["server_settings_raw"] })
    });

    if (isPending || !data) return null;
    const flags: ServerFeatureFlags = {
        free_tier_failover_enabled: data["free_tier_failover_enabled"] !== "false",
        cache_enabled: data["cache_enabled"] === "true",
        notify_webhook_url: data["notify_webhook_url"] ?? ""
    };

    const ToggleRow = (
        label: string,
        hint: string,
        keyName: "free_tier_failover_enabled" | "cache_enabled",
        Icon: typeof Zap
    ) => (
        <div className="flex items-center justify-between gap-4 p-3.5">
            <div className="space-y-0.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Icon className="size-3.5 text-muted-foreground" />
                    <span>{label}</span>
                </label>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
            </div>
            <Switch
                checked={flags[keyName]}
                disabled={mutation.isPending}
                onCheckedChange={(val) => mutation.mutate({ [keyName]: String(val) })}
            />
        </div>
    );

    return (
        <div className="rounded-xl border border-border/80 bg-card/60 shadow-2xs divide-y divide-border/60">
            <div className="p-3.5 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                    Server Features
                </p>
            </div>
            {ToggleRow(
                "Free-Tier Failover",
                "Cascade dsfree → mfree → zen when a free provider fails (429/5xx).",
                "free_tier_failover_enabled",
                Zap
            )}
            {ToggleRow(
                "Response Cache",
                "Serve identical requests from an in-memory cache for 60 seconds.",
                "cache_enabled",
                DatabaseZap
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5">
                <div className="space-y-0.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Webhook className="size-3.5 text-muted-foreground" />
                        <span>Failure Webhook</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                        POST a JSON alert here when every candidate for a model fails.
                    </p>
                </div>
                <Input
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
                    defaultValue={flags.notify_webhook_url}
                    className="w-full sm:w-80 h-8 text-xs font-mono"
                    onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value !== flags.notify_webhook_url) {
                            mutation.mutate({ notify_webhook_url: value });
                            toast.success("Failure webhook saved");
                        }
                    }}
                />
            </div>
        </div>
    );
}

function SettingsPage() {
    const queryClient = useQueryClient();
    const { theme, toggleTheme } = useTheme();
    const {
        settings,
        updateSetting,
        resetToDefaults,
        exportSettings,
        importSettings,
        getStorageStats
    } = useSettings();
    const { hasUpdate, latestVersion } = useVersion();

    const apiBase = getGatewayBaseUrl();
    const [activeTab, setActiveTab] = useState<SettingsTab>("security");

    // Fetch server settings from /v1/settings
    const { data: serverSettings, isPending: isLoadingServerSettings } =
        useQuery<ServerSettingsResponse>({
            queryKey: ["server_settings"],
            queryFn: () => api.get<ServerSettingsResponse>("/v1/settings")
        });

    const [requireApiKey, setRequireApiKey] = useState<boolean>(false);

    useEffect(() => {
        if (serverSettings) {
            const val = serverSettings.require_api_key ?? serverSettings.requireApiKey;
            if (typeof val === "boolean") {
                setRequireApiKey(val);
            }
        }
    }, [serverSettings]);

    // Mutation to update server settings
    const updateServerMutation = useMutation({
        mutationFn: (newRequireApiKey: boolean) =>
            api.post("/v1/settings", {
                require_api_key: newRequireApiKey
            }),
        onSuccess: (_data, newRequireApiKey) => {
            queryClient.invalidateQueries({ queryKey: ["server_settings"] });
            toast.success(
                newRequireApiKey ? "API Key Authentication Required" : "Open Access Mode Enabled",
                {
                    description: newRequireApiKey
                        ? "Gateway endpoints will now require Bearer token authorization."
                        : "Gateway endpoints are now accessible without an API key."
                }
            );
        },
        onError: (err) => {
            toast.error("Failed to update security setting", {
                description: err instanceof Error ? err.message : "Unknown error"
            });
        }
    });

    const handleToggleRequireApiKey = (value: boolean) => {
        setRequireApiKey(value);
        updateServerMutation.mutate(value);
    };

    const tabs: { id: SettingsTab; label: string; icon: typeof Palette; hasBadge?: boolean }[] = [
        { id: "security", label: "Security & API Key", icon: KeyRound },
        { id: "gateway", label: "Gateway & Proxy", icon: Server },
        { id: "appearance", label: "Appearance", icon: Palette },
        { id: "logging", label: "Logging & Privacy", icon: Shield },
        { id: "data", label: "Data & Storage", icon: Database },
        { id: "system", label: "System Diagnostics", icon: Cpu, hasBadge: hasUpdate }
    ];

    if (isLoadingServerSettings) {
        return <SettingsSkeleton />;
    }

    return (
        <div className="mx-auto w-full max-w-5xl flex flex-col gap-6 font-mono">
            {/* Header */}
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end border-b border-border/80 pb-5">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                        Control Plane
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Settings & Operations
                        </h1>
                        {hasUpdate && latestVersion && (
                            <button
                                type="button"
                                onClick={() => setActiveTab("system")}
                                className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-500 hover:bg-amber-500/20 transition-colors cursor-pointer"
                            >
                                <ArrowUpCircle className="size-3 text-amber-500" />
                                <span>Update {latestVersion} available</span>
                            </button>
                        )}
                    </div>
                    <p className="mt-1 max-w-2xl text-xs text-muted-foreground leading-relaxed">
                        Manage gateway routing rules, authentication requirements, telemetry
                        logging, and UI preferences.
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={exportSettings}
                        className="h-8 text-xs font-medium cursor-pointer gap-1.5 border-border/80 bg-card hover:bg-secondary/60 transition-colors shadow-2xs"
                    >
                        <Download className="size-3.5 text-muted-foreground" />
                        <span>Export Config</span>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetToDefaults}
                        className="h-8 text-xs font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 border-border/80 bg-card transition-colors cursor-pointer shadow-2xs gap-1.5"
                    >
                        <RotateCcw className="size-3.5" />
                        <span>Reset</span>
                    </Button>
                </div>
            </header>

            {/* Layout: Sidebar Tabs + Content Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                {/* Navigation Tabs */}
                <nav
                    aria-label="Settings sections"
                    className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:sticky md:top-0 z-10"
                >
                    {tabs.map(({ id, label, icon: Icon, hasBadge }) => {
                        const isActive = activeTab === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setActiveTab(id)}
                                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all text-left whitespace-nowrap cursor-pointer ${
                                    isActive
                                        ? "bg-foreground text-background shadow-xs"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                }`}
                            >
                                <Icon className="size-3.5 shrink-0" />
                                <span>{label}</span>
                                {hasBadge && (
                                    <span className="ml-auto inline-flex items-center rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/40 px-1.5 py-0.2 text-[9px] font-bold">
                                        Update
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Main Settings Panel */}
                <main className="md:col-span-3 space-y-4">
                    {activeTab === "security" && (
                        <SecuritySettings
                            requireApiKey={requireApiKey}
                            onToggleRequireApiKey={handleToggleRequireApiKey}
                            isUpdating={updateServerMutation.isPending}
                            apiBase={apiBase}
                        />
                    )}

                    {activeTab === "gateway" && (
                        <div className="space-y-4">
                            <ServerFeaturesCard />
                            <GatewaySettings settings={settings} updateSetting={updateSetting} />
                        </div>
                    )}

                    {activeTab === "appearance" && (
                        <AppearanceSettings
                            theme={theme}
                            toggleTheme={toggleTheme}
                            settings={settings}
                            updateSetting={updateSetting}
                        />
                    )}

                    {activeTab === "logging" && (
                        <LoggingSettings settings={settings} updateSetting={updateSetting} />
                    )}

                    {activeTab === "data" && (
                        <DataSettings
                            exportSettings={exportSettings}
                            importSettings={importSettings}
                            resetToDefaults={resetToDefaults}
                            getStorageStats={getStorageStats}
                        />
                    )}

                    {activeTab === "system" && <SystemSettings apiBase={apiBase} />}
                </main>
            </div>
        </div>
    );
}
