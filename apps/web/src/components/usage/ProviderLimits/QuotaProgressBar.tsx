import { formatResetTime } from "./utils";

const getColorClasses = (percentage: number) => {
    if (percentage > 70) {
        return {
            text: "text-green-500",
            bg: "bg-green-500",
            bgLight: "bg-green-500/10",
            emoji: "🟢"
        };
    }
    if (percentage >= 30) {
        return {
            text: "text-yellow-500",
            bg: "bg-yellow-500",
            bgLight: "bg-yellow-500/10",
            emoji: "🟡"
        };
    }
    return {
        text: "text-red-500",
        bg: "bg-red-500",
        bgLight: "bg-red-500/10",
        emoji: "🔴"
    };
};

const formatResetTimeDisplay = (resetTime: string | null) => {
    if (!resetTime) return null;
    try {
        const resetDate = new Date(resetTime);
        const now = new Date();
        const isToday = resetDate.toDateString() === now.toDateString();
        const isTomorrow = resetDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();
        
        const timeStr = resetDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
        if (isToday) return `Today, ${timeStr}`;
        if (isTomorrow) return `Tomorrow, ${timeStr}`;
        
        return resetDate.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
    } catch {
        return null;
    }
};

export default function QuotaProgressBar({
    percentage = 0,
    label = "",
    used = 0,
    total = 0,
    unlimited = false,
    resetTime = null,
    recurring = true,
}: {
    percentage?: number;
    label?: string;
    used?: number;
    total?: number;
    unlimited?: boolean;
    resetTime?: string | null;
    recurring?: boolean;
}) {
    const colors = getColorClasses(percentage);
    const countdown = formatResetTime(resetTime);
    const resetDisplay = formatResetTimeDisplay(resetTime);
    const resetWord = recurring ? "Reset" : "Expires";

    return (
        <div className="space-y-2 font-mono">
            <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{label}</span>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">{colors.emoji}</span>
                    <span className={`font-medium ${colors.text}`}>{percentage}%</span>
                </div>
            </div>

            {!unlimited && (
                <div className={`h-2 rounded-full overflow-hidden ${colors.bgLight}`}>
                    <div className={`h-full transition-all duration-300 ${colors.bg}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{used.toLocaleString()} / {total.toLocaleString()} requests</span>
                {countdown !== "-" && (
                    <div className="flex items-center gap-1">
                        <span>•</span>
                        <span className="font-medium">{resetWord} in {countdown}</span>
                    </div>
                )}
            </div>

            {resetDisplay && (
                <div className="text-[10px] text-muted-foreground/70">
                    {resetWord} at {resetDisplay}
                </div>
            )}
        </div>
    );
}
