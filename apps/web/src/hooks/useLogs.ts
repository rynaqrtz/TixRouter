import { useMemo, useState } from "react";
import type { RequestLogEntry } from "@tixrouter/types";

export type LogStatusFilter = "all" | "success" | "error";

export function useLogs(logs: RequestLogEntry[]) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<LogStatusFilter>("all");
    const [modelFilter, setModelFilter] = useState("all");
    const [providerFilter, setProviderFilter] = useState("all");
    const [minLatency, setMinLatency] = useState(0);

    const models = useMemo(
        () => Array.from(new Set(logs.map((l) => l.model))).sort(),
        [logs]
    );
    const providers = useMemo(
        () => Array.from(new Set(logs.map((l) => l.providerId))).sort(),
        [logs]
    );

    const filteredLogs = useMemo(
        () =>
            logs.filter((log) => {
                const q = searchQuery.toLowerCase();
                const matchesQuery =
                    !q ||
                    log.model.toLowerCase().includes(q) ||
                    log.providerId.toLowerCase().includes(q) ||
                    log.id.toLowerCase().includes(q);

                const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
                if (statusFilter === "success" && !isSuccess) return false;
                if (statusFilter === "error" && isSuccess) return false;

                if (modelFilter !== "all" && log.model !== modelFilter) return false;
                if (providerFilter !== "all" && log.providerId !== providerFilter) return false;
                if (minLatency > 0 && log.latencyMs < minLatency) return false;

                return true;
            }),
        [logs, searchQuery, statusFilter, modelFilter, providerFilter, minLatency]
    );

    return {
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        modelFilter,
        setModelFilter,
        providerFilter,
        setProviderFilter,
        minLatency,
        setMinLatency,
        models,
        providers,
        filteredLogs
    };
}
