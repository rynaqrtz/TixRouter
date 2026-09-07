import { getAllProvidersDB, getRecentLogsDB, getSavingsSummaryDB, getUsageByModelDB, getUsageSummaryDB } from "@tixrouter/db";
import { KNOWN_PROVIDERS } from "@tixrouter/constants";
import type { RequestLogEntry, UsageStats } from "@tixrouter/types";
import { formatCost } from "@tixrouter/pricing";

export class LogsLogic {
    public static getRecentLogs(limit: number = 50): RequestLogEntry[] {
        return getRecentLogsDB(limit);
    }

    public static getUsageStats(): UsageStats {
        const summary = getUsageSummaryDB();
        const byModel = getUsageByModelDB();
        const freeIds = new Set<string>();
        for (const provider of KNOWN_PROVIDERS) {
            if (provider.category === "free_tier") {
                freeIds.add(provider.id);
                if (provider.alias) freeIds.add(provider.alias);
            }
        }
        for (const row of getAllProvidersDB()) {
            if (row.category === "free_tier") freeIds.add(row.id);
        }
        const savings = getSavingsSummaryDB([...freeIds]);

        return {
            object: "usage",
            ...summary,
            costLabel: formatCost(summary.totalEstimatedCost),
            estimated: true,
            byModel,
            savings: { ...savings, savedLabel: formatCost(savings.savedCost) }
        };
    }
}
