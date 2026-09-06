import { ANTHROPIC_PROVIDER } from "./anthropic.js";
import { ANTIGRAVITY_PROVIDER } from "./antigravity.js";
import { ARCEE_PROVIDER } from "./arcee.js";
import { BAI_PROVIDER } from "./bai.js";
import { BLUESMINDS_PROVIDER } from "./bluesminds.js";
import { BYTEPLUS_PROVIDER } from "./byteplus.js";
import { CEREBRAS_PROVIDER } from "./cerebras.js";
import { CHUTES_PROVIDER } from "./chutes.js";
import { CLOUDFLARE_PROVIDER } from "./cloudflare.js";
import { COHERE_PROVIDER } from "./cohere.js";
import { CODEBUDDY_CN_PROVIDER, CODEBUDDY_PROVIDER } from "./codebuddy.js";
import { COMMANDCODE_PROVIDER } from "./commandcode.js";
import { DEEPINFRA_PROVIDER } from "./deepinfra.js";
import { DEEPSEEK_PROVIDER } from "./deepseek.js";
import { DEEPSEEK_FREE_PROVIDER } from "./deepseek-free.js";
import { FEATHERLESS_PROVIDER } from "./featherless.js";
import { FIREWORKS_PROVIDER } from "./fireworks.js";
import { GEMINI_PROVIDER } from "./gemini.js";
import { GLM_PROVIDER } from "./glm.js";
import { GMI_PROVIDER } from "./gmi.js";
import { GOROUTER_PROVIDER } from "./gorouter.js";
import { GROQ_PROVIDER } from "./groq.js";
import { HUGGINGFACE_PROVIDER } from "./huggingface.js";
import { HYPERBOLIC_PROVIDER } from "./hyperbolic.js";
import { KIMI_PROVIDER } from "./kimi.js";
import { KIRO_PROVIDER } from "./kiro.js";
import { LLAMACPP_PROVIDER } from "./llamacpp.js";
import { LMSTUDIO_PROVIDER } from "./lmstudio.js";
import { MISTRAL_PROVIDER } from "./mistral.js";
import { MISTRAL_FREE_PROVIDER } from "./mistral-free.js";
import { MINIMAX_PROVIDER } from "./minimax.js";
import { NEBIUS_PROVIDER } from "./nebius.js";
import { NEOSANTARA_PROVIDER } from "./neosantara.js";
import { NOVITAAI_PROVIDER } from "./novita.js";
import { NVIDIA_PROVIDER } from "./nvidia.js";
import { OLLAMA_CLOUD_PROVIDER } from "./ollama-cloud.js";
import { OLLAMA_PROVIDER } from "./ollama.js";
import { OPENAI_CODEX_PROVIDER } from "./openai.js";
import { OPENCODE_ZEN_PROVIDER } from "./opencode.js";
import { OPENROUTER_PROVIDER } from "./openrouter.js";
import { PERPLEXITY_PROVIDER } from "./perplexity.js";
import { QIANFAN_PROVIDER } from "./qianfan.js";
import { QODER_PROVIDER } from "./qoder.js";
import { SAMBANOVA_PROVIDER } from "./sambanova.js";
import { SEEKAI_PROVIDER } from "./seekai.js";
import { SGLANG_PROVIDER } from "./sglang.js";
import { SILICONFLOW_PROVIDER } from "./siliconflow.js";
import { TABITOKEN_PROVIDER } from "./tabitoken.js";
import { TENCENT_TOKENHUB_PROVIDER } from "./tencent-tokenhub.js";
import { TOGETHER_PROVIDER } from "./together.js";
import { TOKENROUTER_PROVIDER } from "./tokenrouter.js";
import { VENICE_PROVIDER } from "./venice.js";
import { VERTEX_PROVIDER } from "./vertex.js";
import { VLLM_PROVIDER } from "./vllm.js";
import { VOLCENGINE_PROVIDER } from "./volcengine.js";
import { XAI_PROVIDER } from "./xai.js";
import type { ProviderMetadata } from "./types.js";

export const KNOWN_PROVIDERS = [
    KIRO_PROVIDER,
    NEOSANTARA_PROVIDER,
    GOROUTER_PROVIDER,
    BLUESMINDS_PROVIDER,
    SEEKAI_PROVIDER,
    TABITOKEN_PROVIDER,
    TOKENROUTER_PROVIDER,
    OPENAI_CODEX_PROVIDER,
    ANTHROPIC_PROVIDER,
    ANTIGRAVITY_PROVIDER,
    COMMANDCODE_PROVIDER,
    QODER_PROVIDER,
    CODEBUDDY_PROVIDER,
    CODEBUDDY_CN_PROVIDER,
    OPENCODE_ZEN_PROVIDER,
    BAI_PROVIDER,
    DEEPSEEK_FREE_PROVIDER,
    MISTRAL_FREE_PROVIDER,
    DEEPSEEK_PROVIDER,
    GROQ_PROVIDER,
    MISTRAL_PROVIDER,
    GEMINI_PROVIDER,
    TOGETHER_PROVIDER,
    OPENROUTER_PROVIDER,
    CEREBRAS_PROVIDER,
    FIREWORKS_PROVIDER,
    XAI_PROVIDER,
    COHERE_PROVIDER,
    PERPLEXITY_PROVIDER,
    SILICONFLOW_PROVIDER,
    NEBIUS_PROVIDER,
    CLOUDFLARE_PROVIDER,
    HUGGINGFACE_PROVIDER,
    NVIDIA_PROVIDER,
    SAMBANOVA_PROVIDER,
    VERTEX_PROVIDER,
    GLM_PROVIDER,
    KIMI_PROVIDER,
    MINIMAX_PROVIDER,
    CHUTES_PROVIDER,
    HYPERBOLIC_PROVIDER,
    OLLAMA_PROVIDER,
    OLLAMA_CLOUD_PROVIDER,
    NOVITAAI_PROVIDER,
    DEEPINFRA_PROVIDER,
    FEATHERLESS_PROVIDER,
    GMI_PROVIDER,
    VENICE_PROVIDER,
    QIANFAN_PROVIDER,
    VOLCENGINE_PROVIDER,
    BYTEPLUS_PROVIDER,
    TENCENT_TOKENHUB_PROVIDER,
    ARCEE_PROVIDER,
    VLLM_PROVIDER,
    SGLANG_PROVIDER,
    LMSTUDIO_PROVIDER,
    LLAMACPP_PROVIDER
] as const satisfies readonly ProviderMetadata[];

export const KNOWN_PROVIDER_MAP = Object.freeze(
    Object.fromEntries(KNOWN_PROVIDERS.map((Provider) => [Provider.id, Provider]))
) as Readonly<Record<string, ProviderMetadata>>;

const KNOWN_PROVIDER_IDS_DESC = Object.freeze(
    Object.keys(KNOWN_PROVIDER_MAP).sort((A, B) => B.length - A.length)
);

const LEGACY_ALIAS_MAP: Readonly<Record<string, string>> = Object.freeze({
    claude: "claude",
    cbai: "codebuddy"
});

export function providerById(Id: string): ProviderMetadata | undefined {
    return KNOWN_PROVIDER_MAP[Id];
}

export function isKnownProvider(Id: string): boolean {
    return Id in KNOWN_PROVIDER_MAP;
}

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function providerBaseId(Id: string): string {
    if (UUID_RE.test(Id)) return Id;
    return (
        KNOWN_PROVIDER_IDS_DESC.find(
            (Candidate) =>
                Id === Candidate || Id.startsWith(`${Candidate}_`) || Id.startsWith(`${Candidate}-`)
        ) ??
        Id.split("_")[0]?.split("-")[0] ??
        Id
    );
}

export function isProviderBaseId(Id: string, BaseId: string): boolean {
    return Id === BaseId || Id.startsWith(`${BaseId}_`) || Id.startsWith(`${BaseId}-`);
}

export function providerAlias(BaseId: string): string {
    return KNOWN_PROVIDER_MAP[BaseId]?.alias ?? BaseId;
}

export function providerTypeForAlias(Alias: string): string | null {
    if (Alias in LEGACY_ALIAS_MAP) return LEGACY_ALIAS_MAP[Alias];
    return KNOWN_PROVIDERS.find((P) => P.alias === Alias || P.id === Alias)?.id ?? null;
}

export function getProviderWebsiteUrl(
    ProviderId: string,
    DefaultBaseUrl?: string
): string | undefined {
    const BaseId = providerBaseId(ProviderId);
    const Metadata = KNOWN_PROVIDER_MAP[ProviderId] ?? KNOWN_PROVIDER_MAP[BaseId];
    if (Metadata?.web_url) return Metadata.web_url;

    if (!DefaultBaseUrl) return undefined;
    try {
        return new URL(DefaultBaseUrl).origin;
    } catch {
        return undefined;
    }
}
