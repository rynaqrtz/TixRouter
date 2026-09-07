import { Check, Moon, Palette, Sun, LayoutGrid, Type } from "lucide-react";
import type { AppSettings } from "@/hooks/useSettings";

interface AppearanceSettingsProps {
    theme: "light" | "dark";
    toggleTheme: (event?: React.MouseEvent) => void;
    settings: AppSettings;
    updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function AppearanceSettings({
    theme,
    toggleTheme,
    settings,
    updateSetting
}: AppearanceSettingsProps) {
    return (
        <div className="rounded-xl border border-border/80 bg-card p-5 space-y-6 shadow-2xs">
            <div>
                <div className="flex items-center gap-2">
                    <Palette className="size-4 text-foreground" />
                    <h2 className="text-sm font-bold text-foreground tracking-tight">
                        Appearance & Interface
                    </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Customize your color palette, table density, and dashboard visual presentation.
                </p>
            </div>

            {/* Theme Selection */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-foreground">Color Theme Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                    {/* Dark Mode Option */}
                    <button
                        type="button"
                        onClick={(e) => theme !== "dark" && toggleTheme(e)}
                        className={`group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer ${
                            theme === "dark"
                                ? "border-foreground bg-muted/60 text-foreground ring-1 ring-foreground/20 shadow-xs"
                                : "border-border/80 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-foreground">
                                    <Moon className="size-3.5" />
                                </div>
                                <span className="text-xs font-bold text-foreground">
                                    Dark Cockpit
                                </span>
                            </div>
                            {theme === "dark" && (
                                <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                                    <Check className="size-3 stroke-[3]" />
                                </span>
                            )}
                        </div>

                        {/* Dark Mode Mini Mockup */}
                        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5 space-y-1.5 opacity-90">
                            <div className="flex items-center justify-between">
                                <div className="h-2 w-16 rounded bg-zinc-800" />
                                <div className="h-2 w-6 rounded bg-zinc-700" />
                            </div>
                            <div className="h-1.5 w-full rounded bg-zinc-900" />
                            <div className="h-1.5 w-4/5 rounded bg-zinc-900" />
                        </div>
                    </button>

                    {/* Light Mode Option */}
                    <button
                        type="button"
                        onClick={(e) => theme !== "light" && toggleTheme(e)}
                        className={`group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer ${
                            theme === "light"
                                ? "border-foreground bg-muted/60 text-foreground ring-1 ring-foreground/20 shadow-xs"
                                : "border-border/80 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-100 border border-zinc-200 text-foreground">
                                    <Sun className="size-3.5" />
                                </div>
                                <span className="text-xs font-bold text-foreground">
                                    Light Paper
                                </span>
                            </div>
                            {theme === "light" && (
                                <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                                    <Check className="size-3 stroke-[3]" />
                                </span>
                            )}
                        </div>

                        {/* Light Mode Mini Mockup */}
                        <div className="rounded-md border border-zinc-200 bg-white p-2.5 space-y-1.5 opacity-90">
                            <div className="flex items-center justify-between">
                                <div className="h-2 w-16 rounded bg-zinc-200" />
                                <div className="h-2 w-6 rounded bg-zinc-300" />
                            </div>
                            <div className="h-1.5 w-full rounded bg-zinc-100" />
                            <div className="h-1.5 w-4/5 rounded bg-zinc-100" />
                        </div>
                    </button>
                </div>
            </div>

            {/* UI Density */}
            <div className="space-y-3 pt-5 border-t border-border/70">
                <div className="space-y-0.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <LayoutGrid className="size-3.5 text-muted-foreground" />
                        <span>Interface Table & Row Density</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                        Control table row padding and vertical layout spacing across logs and model
                        catalogs.
                    </p>
                </div>

                <div className="inline-flex items-center rounded-lg border border-border/80 bg-muted/40 p-1 font-mono gap-1">
                    {(["compact", "cozy"] as const).map((density) => {
                        const isActive = settings.uiDensity === density;
                        return (
                            <button
                                key={density}
                                type="button"
                                onClick={() => updateSetting("uiDensity", density)}
                                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold capitalize transition-all cursor-pointer ${
                                    isActive
                                        ? "bg-background text-foreground shadow-xs border border-border/80 font-bold"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                                }`}
                            >
                                {density === "compact" ? "Compact (Dense)" : "Cozy (Relaxed)"}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Typography Callout */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 flex items-start gap-3">
                <Type className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">JetBrains Mono Engine:</strong> TixRouter uses
                    monospaced typography throughout the operational cockpit for maximum visual
                    alignment of tokens, hashes, JSON payloads, and timestamps.
                </div>
            </div>
        </div>
    );
}
