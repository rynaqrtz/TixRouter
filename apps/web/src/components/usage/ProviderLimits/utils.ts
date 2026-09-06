/**
 * Format ISO date string to countdown format
 */
export function formatResetTime(date: string | Date | null): string {
    if (!date) return "-";

    try {
        const resetDate = typeof date === "string" ? new Date(date) : date;
        const now = new Date();
        const diffMs = resetDate.getTime() - now.getTime();

        if (diffMs <= 0) return "-";

        const totalMinutes = Math.ceil(diffMs / (1000 * 60));
        
        if (totalMinutes < 60) return `${totalMinutes}m`;
        
        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;
        
        if (totalHours < 24) return `${totalHours}h ${remainingMinutes}m`;
        
        const days = Math.floor(totalHours / 24);
        const remainingHours = totalHours % 24;
        return `${days}d ${remainingHours}h ${remainingMinutes}m`;
    } catch {
        return "-";
    }
}

/**
 * Get remaining percentage
 */
export function getRemainingPercentage(quota: any): number {
    if (quota?.remaining !== undefined) return Math.max(0, Math.round(quota.remaining));
    if (quota?.remainingPercentage !== undefined) return Math.round(quota.remainingPercentage);
    
    if (!quota.total || quota.total === 0) return 0;
    if (!quota.used || quota.used < 0) return 100;
    if (quota.used >= quota.total) return 0;

    return Math.round(((quota.total - quota.used) / quota.total) * 100);
}
