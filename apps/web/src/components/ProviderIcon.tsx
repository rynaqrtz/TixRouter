import { useState } from "react";

const ICON_MAPPING: Record<string, string> = {
    // Original providers
    bai: "/icons/providers/bai.svg",
    "b.ai": "/icons/providers/bai.svg",
    openai_codex: "/icons/providers/codex.png",
    openai: "/icons/providers/openai.png",
    chatgpt: "/icons/providers/openai.png",
    anthropic: "/icons/providers/anthropic.png",
    claude: "/icons/providers/claude.png",
    antigravity: "/icons/providers/antigravity.png",
    neosantara: "/icons/providers/neosantara.png",
    gorouter: "/icons/providers/newapi.png",
    newapi: "/icons/providers/newapi.png",
    bluesminds: "/icons/providers/bluesminds.png",
    "deepseek-free": "/icons/providers/deepseek-free.jpg",
    dsfree: "/icons/providers/deepseek-free.jpg",
    seekai: "/icons/providers/newapi.png",
    tabitoken: "/icons/providers/newapi.png",
    tokenrouter: "/icons/providers/tokenrouter.png",
    groq: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/groq.png",
    openrouter: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/openrouter.png",
    copilot: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/copilot.png",
    cursor: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/cursor.png",
    qoder: "/icons/providers/newapi.png",
    kilocode: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/kilocode.png",
    kilo: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/kilocode.png",
    cline: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/cline.png",
    codebuddy: "/icons/providers/codebuddy.png",
    "codebuddy-cn": "/icons/providers/codebuddy-cn.png",
    "codebuddy-intl": "/icons/providers/codebuddy-intl.png",
    kimi: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/kimi.png",
    moonshot: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/kimi.png",
    grok: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/grok-web.png",
    xai: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/xai.png",
    gemini: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/gemini.png",
    huggingface: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/huggingface.png",
    ollama: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/ollama.png",
    deepseek: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/deepseek.png",
    mistral: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/mistral.png",
    cohere: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/cohere.png",
    together: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/together.png",
    siliconflow: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/siliconflow.png",
    opencode: "/icons/providers/opencode.png",
    opencode_zen: "/icons/providers/opencode.png",
    "opencode-zen": "/icons/providers/opencode.png",

    // Batch 1 - Major API providers
    cerebras: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/cerebras.png",
    fireworks: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/fireworks.png",
    nvidia: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/nvidia.png",
    sambanova: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/sambanova.png",
    vertex: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/gemini.png",
    perplexity: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/perplexity.png",
    cloudflare: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/cloudflare-ai.png",
    nebius: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/nebius.png",

    // Batch 2 - Chinese & new providers
    glm: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/glm.png",
    zhipu: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/glm.png",
    minimax: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/minimax.png",
    chutes: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/chutes.png",
    hyperbolic: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/hyperbolic.png",

    // Batch 3 - Cloud & self-hosted
    "ollama-cloud": "https://raw.githubusercontent.com/decolua/9router/master/public/providers/ollama.png",
    novita: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/novita.png",
    deepinfra: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/deepinfra.png",
    featherless: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/featherless.png",
    gmi: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/gmi-cloud.png",
    venice: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/venice.png",

    // Batch 4 - Chinese enterprise
    qianfan: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/qianfan.png",
    volcengine: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/volcengine.png",
    byteplus: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/byteplus.png",
    "tencent-tokenhub": "https://raw.githubusercontent.com/decolua/9router/master/public/providers/tencent.png",

    // Batch 5 - More providers
    arcee: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/arcee.png",

    // Self-hosted (use llama.cpp icon as fallback)
    vllm: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/vllm.png",
    sglang: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/sglang.png",
    lmstudio: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/lmstudio.png",
    llamacpp: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/llamacpp.png",

    // Misc
    kiro: "https://raw.githubusercontent.com/decolua/9router/master/public/providers/kiro.png",
    commandcode: "/icons/providers/newapi.png"
};

export function ProviderIcon({
    providerId,
    className = "size-5"
}: {
    providerId: string;
    className?: string;
}) {
    const [hasError, setHasError] = useState(false);
    const id = providerId.toLowerCase().trim();

    if (id === "opencode" || id === "opencode_zen" || id === "opencode-zen" || id.includes("opencode")) {
        return (
            <svg
                fill="currentColor"
                fillRule="evenodd"
                viewBox="0 0 24 24"
                className={`${className} shrink-0 text-foreground`}
                xmlns="http://www.w3.org/2000/svg"
            >
                <title>OpenCode Zen</title>
                <path d="M16 6H8v12h8V6zm4 16H4V2h16v20z" />
            </svg>
        );
    }

    if (hasError) {
        const initial = providerId.trim().charAt(0).toUpperCase() || "P";
        return (
            <div
                className={`${className} flex items-center justify-center rounded-md bg-secondary text-[10.5px] font-bold text-foreground select-none shrink-0 font-mono`}
                title={providerId}
            >
                {initial}
            </div>
        );
    }

    // 1. Direct key match
    let src: string | undefined = ICON_MAPPING[id];

    // 2. Partial substring match
    if (!src) {
        for (const key of Object.keys(ICON_MAPPING)) {
            if (id.includes(key)) {
                src = ICON_MAPPING[key];
                break;
            }
        }
    }

    // 3. Fallback to `/icons/providers/${id}.png`
    if (!src) {
        src = `/icons/providers/${id.replace(/[^a-z0-9_-]/g, "")}.png`;
    }

    return (
        <img
            src={src}
            alt={providerId}
            className={`${className} rounded object-contain shrink-0`}
            onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (!img.dataset.fallbackTried) {
                    img.dataset.fallbackTried = "remote";
                    img.src = `https://raw.githubusercontent.com/decolua/9router/master/public/providers/${id}.png`;
                } else {
                    setHasError(true);
                }
            }}
        />
    );
}
