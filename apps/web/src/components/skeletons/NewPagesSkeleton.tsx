import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsSkeleton() {
    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 font-mono">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end border-b border-border/80 pb-5">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-28 rounded" />
                    <Skeleton className="h-7 w-44 rounded-md" />
                    <Skeleton className="h-3.5 w-80 max-w-full rounded" />
                </div>
                <div className="flex items-center gap-2">
                    {[7, 14, 30, 90].map((d) => (
                        <Skeleton key={d} className="h-8 w-12 rounded-md" />
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
            </div>
        </div>
    );
}

export function PlaygroundSkeleton() {
    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 font-mono">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end border-b border-border/80 pb-5">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-28 rounded" />
                    <Skeleton className="h-7 w-44 rounded-md" />
                    <Skeleton className="h-3.5 w-80 max-w-full rounded" />
                </div>
                <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
            <Skeleton className="h-96 rounded-xl" />
        </div>
    );
}