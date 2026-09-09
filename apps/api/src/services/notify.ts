import {
    getAPIKeyByIdDB,
    getSettingDB,
    setAPIKeyAlertStateDB
} from "@tixrouter/db";

type AlertEvent = "provider_failure" | "budget_credit" | "budget_quota";

const NOTIFY_COOLDOWN_MS: Record<AlertEvent, number> = {
    provider_failure: 5 * 60_000,
    budget_credit: 60 * 60_000,
    budget_quota: 60 * 60_000
};

const lastNotifiedAt = new Map<AlertEvent, number>();

function eventsFilter(): string[] {
    return getSettingDB("notify_events", "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
}

function eventEnabled(event: AlertEvent): boolean {
    const filter = eventsFilter();
    return filter.length === 0 || filter.includes(event);
}

type AlertChannel = { kind: "webhook"; url: string } | { kind: "telegram"; chatId: string };

export function alertChannels(): AlertChannel[] {
    const targets: Array<{ kind: "webhook"; url: string } | { kind: "telegram"; chatId: string }> = [];
    const webhookUrl = getSettingDB("notify_webhook_url", "");
    if (webhookUrl) targets.push({ kind: "webhook", url: webhookUrl });
    const telegramChatId = getSettingDB("notify_telegram_chat_id", "");
    if (telegramChatId) targets.push({ kind: "telegram", chatId: telegramChatId });
    return targets;
}

async function postJSON(url: string, body: unknown): Promise<boolean> {
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000)
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function sendAlert(event: AlertEvent, payload: Record<string, unknown>): Promise<void> {
    if (!eventEnabled(event)) return;

    const now = Date.now();
    const last = lastNotifiedAt.get(event) ?? 0;
    if (now - last < NOTIFY_COOLDOWN_MS[event]) return;

    const body = JSON.stringify({
        event,
        service: "TixRouter",
        timestamp: new Date(now).toISOString(),
        ...payload
    });

    let delivered = false;
    for (const channel of alertChannels()) {
        if (channel.kind === "webhook") {
            delivered = (await postJSON(channel.url, JSON.parse(body))) || delivered;
        } else {
            const text = `${event}: ${JSON.stringify(payload)}`.slice(0, 4000);
            const botToken = getSettingDB("notify_telegram_bot_token", "");
            if (botToken) {
                delivered =
                    (await postJSON(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        chat_id: channel.chatId,
                        text
                    })) || delivered;
            }
        }
    }

    lastNotifiedAt.set(event, delivered ? now : last);
}

export async function notifyProviderFailure(model: string, err: unknown): Promise<void> {
    await sendAlert("provider_failure", {
        provider: model.split("/")[0] || "default",
        model,
        error: err instanceof Error ? err.message : String(err)
    });
}

export async function notifyBudgetThreshold(apiKeyId: string, kind: "credit" | "quota"): Promise<void> {
    const key = getAPIKeyByIdDB(apiKeyId);
    if (!key) return;
    await setAPIKeyAlertStateDB(apiKeyId, kind === "credit" ? "credit" : "quota", true);
    await sendAlert(kind === "credit" ? "budget_credit" : "budget_quota", {
        api_key_id: apiKeyId,
        api_key_name: key.name,
        usage_cost: key.usage_cost,
        credit_limit: key.credit_limit,
        usage_tokens: key.usage_tokens,
        quota_limit: key.quota_limit
    });
}

export function ClearAlertCooldownsForTest(): void {
    lastNotifiedAt.clear();
}

export function SetAlertEventWindowForTest(event: AlertEvent, at: number): void {
    lastNotifiedAt.set(event, at);
}
