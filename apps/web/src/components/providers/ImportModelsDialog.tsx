import { useState } from "react";
import { Download, FileJson, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ModelObject } from "@rynarouter/types";

interface ImportModelsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    providerName: string;
    providerId: string;
    existingModels: ModelObject[];
    isFetching: boolean;
    isImporting: boolean;
    onFetchModels: () => void;
    onImport: (modelIds: string[]) => void;
}

export function ImportModelsDialog({
    open,
    onOpenChange,
    providerName,
    providerId,
    existingModels,
    isFetching,
    isImporting,
    onFetchModels,
    onImport
}: ImportModelsDialogProps) {
    const [mode, setMode] = useState<"fetch" | "paste">("fetch");
    const [pasteText, setPasteText] = useState("");
    const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState("");

    const handlePasteImport = () => {
        const lines = pasteText
            .split(/[\n,]+/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        if (lines.length === 0) return;
        onImport(lines);
    };

    const handleFetchImport = () => {
        const models = Array.from(selectedModels);
        if (models.length === 0) return;
        onImport(models);
    };

    const toggleModel = (id: string) => {
        setSelectedModels((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const selectAll = () => {
        const filtered = getFilteredModels().map((m) => m.id);
        setSelectedModels(new Set(filtered));
    };

    const deselectAll = () => {
        setSelectedModels(new Set());
    };

    const getFilteredModels = () => {
        if (!filter) return existingModels;
        const lower = filter.toLowerCase();
        return existingModels.filter(
            (m) => m.id.toLowerCase().includes(lower) || m.owned_by?.toLowerCase().includes(lower)
        );
    };

    const filteredModels = getFilteredModels();

    const pasteCount = pasteText
        .split(/[\n,]+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0).length;

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                onOpenChange(v);
                if (!v) {
                    setPasteText("");
                    setSelectedModels(new Set());
                    setFilter("");
                }
            }}
        >
            <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90dvh] sm:max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
                    <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                        <Download className="size-4 text-emerald-500" />
                        <span className="truncate">Import to {providerName}</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Fetch from provider API or paste model IDs manually.
                    </DialogDescription>
                </DialogHeader>

                {/* Mode Segmented Control */}
                <div className="mx-4 sm:mx-6 mb-3">
                    <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
                        <button
                            type="button"
                            onClick={() => setMode("fetch")}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                                mode === "fetch"
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Search className="size-3.5" />
                            <span>Fetch</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("paste")}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                                mode === "paste"
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <FileJson className="size-3.5" />
                            <span>Paste IDs</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6">
                    {mode === "fetch" ? (
                        <div className="flex flex-col gap-3 pb-4">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onFetchModels}
                                disabled={isFetching}
                                className="w-full h-10 text-xs font-semibold cursor-pointer gap-1.5"
                            >
                                {isFetching ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Search className="size-4" />
                                )}
                                <span>{isFetching ? "Fetching..." : "Fetch Available Models"}</span>
                            </Button>

                            {existingModels.length > 0 && (
                                <>
                                    {/* Search + Actions row */}
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder="Filter models..."
                                                value={filter}
                                                onChange={(e) => setFilter(e.target.value)}
                                                className="h-9 pl-8 text-xs"
                                            />
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={selectAll}
                                                className="h-9 px-3 text-[11px] font-semibold cursor-pointer"
                                            >
                                                All
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={deselectAll}
                                                className="h-9 px-3 text-[11px] font-semibold cursor-pointer"
                                            >
                                                Clear
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Model list */}
                                    <div className="rounded-lg border border-border/70 bg-muted/20 divide-y divide-border/40">
                                        {filteredModels.map((m) => {
                                            const bare = m.id.includes("/")
                                                ? m.id.split("/").slice(1).join("/")
                                                : m.id;
                                            const isSelected = selectedModels.has(bare);
                                            return (
                                                <label
                                                    key={m.id}
                                                    className={`flex items-center gap-3 px-3 py-2.5 text-xs font-mono cursor-pointer transition-colors min-h-[44px] ${
                                                        isSelected
                                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                            : "active:bg-muted/60 text-foreground"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleModel(bare)}
                                                        className="size-4 shrink-0 rounded border-border accent-emerald-500"
                                                    />
                                                    <span className="truncate">{bare}</span>
                                                </label>
                                            );
                                        })}
                                    </div>

                                    <p className="text-[11px] text-muted-foreground text-center">
                                        {selectedModels.size} selected · {existingModels.length} available
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 pb-4">
                            <textarea
                                rows={6}
                                value={pasteText}
                                onChange={(e) => setPasteText(e.target.value)}
                                placeholder={"Model IDs, one per line or comma-separated:\n\ngpt-4o\ngpt-4o-mini\nclaude-sonnet-4-20250514"}
                                className="w-full rounded-lg border border-border/80 bg-muted/20 p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none min-h-[120px]"
                            />
                            <p className="text-[11px] text-muted-foreground text-center">
                                {pasteCount} model{pasteCount !== 1 ? "s" : ""} detected
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="px-4 pb-4 pt-2 sm:px-6 sm:pb-5 border-t border-border/50">
                    <div className="flex w-full gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 h-10 cursor-pointer"
                        >
                            Cancel
                        </Button>
                        {mode === "fetch" ? (
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleFetchImport}
                                disabled={selectedModels.size === 0 || isImporting}
                                className="flex-1 h-10 font-semibold gap-1.5 cursor-pointer"
                            >
                                {isImporting ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Plus className="size-4" />
                                )}
                                <span>
                                    Import{selectedModels.size > 0 ? ` ${selectedModels.size}` : ""}
                                </span>
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                size="sm"
                                onClick={handlePasteImport}
                                disabled={pasteCount === 0 || isImporting}
                                className="flex-1 h-10 font-semibold gap-1.5 cursor-pointer"
                            >
                                {isImporting ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Plus className="size-4" />
                                )}
                                <span>Import</span>
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
