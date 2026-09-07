import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { QuotaResponse } from "@tixrouter/types";

export function useQuota() {
    return useQuery({
        queryKey: ["quota"],
        queryFn: () => api.get<QuotaResponse>("/v1/quota"),
        refetchInterval: 15000
    });
}
