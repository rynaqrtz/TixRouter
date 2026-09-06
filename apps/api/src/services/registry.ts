import {
    BAI_BASE_URL,
    BLUESMINDS_BASE_URL,
    CODEBUDDY_BASE_URL,
    CODEBUDDY_CN_BASE_URL,
    CODEBUDDY_CN_DOMAIN,
    CODEBUDDY_CN_USER_AGENT,
    DEFAULT_PROVIDERS,
    GOROUTER_BASE_URL,
    isProviderBaseId,
    isSeedProvider,
    NEOSANTARA_BASE_URL,
    OPENCODE_ZEN_BASE_URL,
    SEED_MARKER,
    SEEKAI_BASE_URL,
    TABITOKEN_BASE_URL,
    TOKENROUTER_BASE_URL
} from "@rynarouter/constants";
import {
    createFallbackRuleDB,
    deleteProviderDB,
    getAllProvidersDB,
    getFallbackRuleByIdDB,
    getSettingDB,
    updateFallbackRuleDB,
    upsertProviderDB
} from "@rynarouter/db";
import {
    AntigravityExecutor,
    AnthropicExecutor,
    BAIExecutor,
    BluesMindsExecutor,
    CodeBuddyExecutor,
    CodexExecutor,
    CommandCodeExecutor,
    DeepSeekFreeExecutor,
    DeepSeekFreePoolExecutor,
    DeepSeekScraperExecutor,
    GoRouterExecutor,
    KiroExecutor,
    MistralFreeExecutor,
    OpenCodeZenExecutor,
    OpenAIExecutor,
    QoderExecutor,
    SeekAIExecutor,
    TabiTokenExecutor,
    TokenRouterExecutor,
    parseAccounts
} from "@rynarouter/executors";
import { ProviderRegistry } from "@rynarouter/providers";

// Create a global ProviderRegistry instance
export const registry = new ProviderRegistry();

/**
 * Seed built-in driver rows into the providers table on first startup, so the
 * dashboard catalog is DB-driven but never empty. Rows are flagged with the
 * seed marker so they are not treated as real connections.
 */
export function seedDefaultProviders(): void {
    const existing = getAllProvidersDB();
    const existingIds = new Set(existing.map((p) => p.id));
    const validSeedIds = new Set(DEFAULT_PROVIDERS.map((p) => p.id));

    // Clean up any stale seed records no longer in DEFAULT_PROVIDERS
    for (const p of existing) {
        if (isSeedProvider(p) && !validSeedIds.has(p.id)) {
            deleteProviderDB(p.id);
        }
    }

    const now = Date.now();
    for (const seed of DEFAULT_PROVIDERS) {
        const existingRow = existing.find((p) => p.id === seed.id);
        if (!existingRow) {
            upsertProviderDB({
                id: seed.id,
                providerId: seed.id,
                name: seed.name,
                category: seed.category,
                protocol: seed.protocol,
                base_url: seed.base_url,
                enabled: true,
                providerSpecificData: { [SEED_MARKER]: "true" },
                createdAt: now
            });
        } else if (isSeedProvider(existingRow)) {
            if (
                existingRow.category !== seed.category ||
                existingRow.protocol !== seed.protocol ||
                existingRow.name !== seed.name ||
                existingRow.base_url !== seed.base_url
            ) {
                upsertProviderDB({
                    ...existingRow,
                    name: seed.name,
                    category: seed.category,
                    protocol: seed.protocol,
                    base_url: seed.base_url
                });
            }
        }
    }
}

const FREE_TIER_FALLBACKS: Array<{ id: string; sourceModel: string; targetModel: string; priority: number }> = [
    { id: "fb-seed-dsfree-mfree", sourceModel: "dsfree/*", targetModel: "mfree/mistral-large", priority: 1 },
    { id: "fb-seed-dsfree-zen", sourceModel: "dsfree/*", targetModel: "zen/big-pickle", priority: 2 },
    { id: "fb-seed-mfree-dsfree", sourceModel: "mfree/*", targetModel: "dsfree/deepseek-v3", priority: 1 },
    { id: "fb-seed-mfree-zen", sourceModel: "mfree/*", targetModel: "zen/big-pickle", priority: 2 },
    { id: "fb-seed-zen-dsfree", sourceModel: "zen/*", targetModel: "dsfree/deepseek-v3", priority: 1 },
    { id: "fb-seed-zen-mfree", sourceModel: "zen/*", targetModel: "mfree/mistral-large", priority: 2 }
];

const FREE_TIER_TRIGGER_STATUSES = [429, 401, 403, 500, 502, 503, 504];

/**
 * Seed the free-tier fallback chain (dsfree <-> mfree <-> zen), so a dead free
 * provider automatically fails over to its siblings. Fixed ids keep the seed
 * idempotent and never touch user-created rules; the enabled state follows the
 * free_tier_failover_enabled setting on every boot.
 */
export function seedDefaultFallbacks(): void {
    const enabled = getSettingDB("free_tier_failover_enabled", "true") === "true";
    for (const rule of FREE_TIER_FALLBACKS) {
        const existing = getFallbackRuleByIdDB(rule.id);
        if (!existing) {
            createFallbackRuleDB({
                id: rule.id,
                sourceModel: rule.sourceModel,
                targetModel: rule.targetModel,
                priority: rule.priority,
                enabled,
                triggerOnStatus: FREE_TIER_TRIGGER_STATUSES
            });
        } else if (existing.enabled !== enabled) {
            updateFallbackRuleDB(rule.id, { enabled });
        }
    }
}

/**
 * Load saved OAuth & Custom providers from SQLite Database on startup
 */
export function loadSavedProvidersFromDB(): void {
    const savedProviders = getAllProvidersDB();
    for (const p of savedProviders) {
        if (!p.enabled) continue;
        // Seed rows describe drivers, not connections; they never get executors.
        if (isSeedProvider(p)) continue;

        const providerType = p.providerId || p.id;
        const baseUrl = p.base_url;

        switch (true) {
            case isProviderBaseId(p.id, "kiro"):
                registry.registerProvider(
                    new KiroExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        refreshToken: p.refreshToken,
                        providerSpecificData: p.providerSpecificData
                    })
                );
                break;
            case isProviderBaseId(p.id, "codebuddy"):
                registry.registerProvider(
                    new CodeBuddyExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl:
                            baseUrl ||
                            (providerType === "codebuddy-cn"
                                ? CODEBUDDY_CN_BASE_URL
                                : CODEBUDDY_BASE_URL),
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        modelPrefix: providerType === "codebuddy-cn" ? "codebuddy-cn" : "codebuddy",
                        ...(providerType === "codebuddy-cn"
                            ? {
                                  domain: CODEBUDDY_CN_DOMAIN,
                                  userAgent: CODEBUDDY_CN_USER_AGENT,
                                  flavor: "cli" as const
                              }
                            : {})
                    })
                );
                break;
            case isProviderBaseId(p.id, "commandcode"):
                registry.registerProvider(
                    new CommandCodeExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "antigravity"):
                registry.registerProvider(
                    new AntigravityExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        refreshToken: p.refreshToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "openai_codex"):
                registry.registerProvider(
                    new CodexExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        refreshToken: p.refreshToken,
                        accountId: p.accountId
                    })
                );
                break;
            case isProviderBaseId(p.id, "neosantara"):
                registry.registerProvider(
                    new OpenAIExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || NEOSANTARA_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "gorouter"):
                registry.registerProvider(
                    new GoRouterExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || GOROUTER_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "bluesminds"):
                registry.registerProvider(
                    new BluesMindsExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || BLUESMINDS_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "seekai"):
                registry.registerProvider(
                    new SeekAIExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || SEEKAI_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "tabitoken"):
                registry.registerProvider(
                    new TabiTokenExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || TABITOKEN_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "tokenrouter"):
                registry.registerProvider(
                    new TokenRouterExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || TOKENROUTER_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "opencode_zen") ||
                isProviderBaseId(p.id, "zen") ||
                providerType === "opencode_zen":
                registry.registerProvider(
                    new OpenCodeZenExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || OPENCODE_ZEN_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "bai") || providerType === "bai":
                registry.registerProvider(
                    new BAIExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl: baseUrl || BAI_BASE_URL,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "qoder"):
                registry.registerProvider(
                    new QoderExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        refreshToken: p.refreshToken,
                        providerSpecificData: p.providerSpecificData
                    })
                );
                break;
            case isProviderBaseId(p.id, "mistral-free"):
                registry.registerProvider(
                    new MistralFreeExecutor({
                        id: p.id || p.providerId,
                        name: p.name
                    })
                );
                break;
            case isProviderBaseId(p.id, "deepseek-free"): {
                const accounts = parseAccounts(p.apiKey || p.accessToken || "");
                const single = {
                    email: p.providerSpecificData?.email ?? accounts[0]?.email ?? "",
                    password: p.providerSpecificData?.password ?? accounts[0]?.password ?? ""
                };
                if (accounts.length > 1) {
                    registry.registerProvider(
                        new DeepSeekFreePoolExecutor({
                            id: p.id || p.providerId,
                            name: p.name,
                            accounts
                        })
                    );
                } else if (single.email && single.password) {
                    registry.registerProvider(
                        new DeepSeekFreeExecutor({
                            id: p.id || p.providerId,
                            name: p.name,
                            email: single.email,
                            password: single.password,
                            token: p.accessToken || undefined
                        })
                    );
                }
                break;
            }
            case isProviderBaseId(p.id, "deepseek"):
                registry.registerProvider(
                    new DeepSeekScraperExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        token: p.apiKey || p.accessToken
                    })
                );
                break;
            case p.protocol === "openai" ||
                p.category === "oauth" ||
                providerType === "openai_codex" ||
                providerType === "openai" ||
                providerType === "custom_openai":
                registry.registerProvider(
                    new OpenAIExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            case isProviderBaseId(p.id, "claude") || providerType === "claude":
                registry.registerProvider(
                    new AnthropicExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken,
                        refreshToken: p.refreshToken,
                        organizationId: p.organizationId
                    })
                );
                break;
            case p.protocol === "anthropic" ||
                providerType === "anthropic" ||
                providerType === "custom_anthropic":
                registry.registerProvider(
                    new AnthropicExecutor({
                        id: p.id || p.providerId,
                        name: p.name,
                        baseUrl,
                        apiKey: p.apiKey,
                        accessToken: p.accessToken
                    })
                );
                break;
            default:
                break;
        }
    }

    // Auto-register built-in free tier providers so users can immediately use them out of the box
    const freeTierSeeds = DEFAULT_PROVIDERS.filter((s) => s.category === "free_tier");
    for (const seed of freeTierSeeds) {
        const hasExplicitConnection = savedProviders.some(
            (p) => (p.id === seed.id || p.providerId === seed.id) && !isSeedProvider(p)
        );
        if (!hasExplicitConnection) {
            if (seed.id === "opencode_zen") {
                registry.registerProvider(
                    new OpenCodeZenExecutor({
                        id: seed.id,
                        name: seed.name,
                        baseUrl: seed.base_url || OPENCODE_ZEN_BASE_URL
                    })
                );
            } else if (seed.id === "mistral-free") {
                registry.registerProvider(new MistralFreeExecutor({ id: seed.id, name: seed.name }));
            }
        }
    }
}

/**
 * Warm model discovery after the HTTP server starts. Keeping this outside the
 * database reload helper avoids network side effects for provider mutations
 * and keeps reloads lazy when a connection is added or removed.
 */
export function warmModelRegistry(): void {
    void registry.refreshModels().catch(() => undefined);
}

// Seed built-in driver rows, then auto load saved DB providers
seedDefaultProviders();
loadSavedProvidersFromDB();
seedDefaultFallbacks();
