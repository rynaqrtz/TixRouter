import { useCallback, useEffect, useState } from "react";
import { api, getGatewayBaseUrl } from "@/lib/api";
import type { APIKeyZod } from "@rynarouter/types";

export interface GatewayInfo {
    baseUrl: string;
    healthy: boolean;
    latencyMs: number | null;
}

export function useCLITools() {
    const [keys, setKeys] = useState<APIKeyZod[]>([]);
    const [loading, setLoading] = useState(true);
    const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo>({
        baseUrl: getGatewayBaseUrl(),
        healthy: false,
        latencyMs: null
    });

    const fetchKeys = useCallback(async () => {
        try {
            const json = await api.get<{ data: APIKeyZod[] }>("/v1/keys");
            setKeys(json.data ?? []);
        } catch (err) {
            console.error("Failed to fetch API keys:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const checkGateway = useCallback(async () => {
        const start = performance.now();
        try {
            await api.get("/v1/settings");
            setGatewayInfo((prev) => ({
                ...prev,
                healthy: true,
                latencyMs: Math.round(performance.now() - start)
            }));
        } catch {
            setGatewayInfo((prev) => ({
                ...prev,
                healthy: false,
                latencyMs: null
            }));
        }
    }, []);

    useEffect(() => {
        void fetchKeys();
        void checkGateway();
    }, [fetchKeys, checkGateway]);

    const activeKeys = keys.filter((k) => k.enabled);

    return {
        keys,
        activeKeys,
        loading,
        gatewayInfo,
        checkGateway,
        refetch: fetchKeys
    };
}
