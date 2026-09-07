import { getSettingDB } from "@tixrouter/db";

const NOTIFY_COOLDOWN_MS = 5 * 60_000;
let lastNotifiedAt = 0;

export async function notifyProviderFailure(model: string, err: unknown): Promise<void> {
    const url = getSettingDB("notify_webhook_url", "");
    if (!url) return;
    const now = Date.now();
    if (now - lastNotifiedAt < NOTIFY_COOLDOWN_MS) return;
    lastNotifiedAt = now;
    const body = JSON.stringify({
        event: "provider_failure",
        service: "TixRouter",
        provider: model.split("/")[0] || "default",
        model,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date(now).toISOString()
    });
    try {
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: AbortSignal.timeout(5000)
        });
    } catch {
        lastNotifiedAt = 0;
    }
}
