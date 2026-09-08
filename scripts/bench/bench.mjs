const ROUTERS = [
    { name: "TixRouter", url: "http://127.0.0.1:20130/v1/chat/completions", key: process.env.TIX_KEY },
    { name: "LiteLLM", url: "http://127.0.0.1:4000/v1/chat/completions", key: "sk-bench" }
];

const MODEL = process.argv[2];
const WARMUP = 1;
const RUNS = 10;
const PAYLOAD = {
    model: MODEL,
    messages: [{ role: "user", content: "Explain in one paragraph what an API gateway is and why it matters for LLM apps." }],
    max_tokens: 120,
    temperature: 0
};

function stats(times) {
    const sorted = [...times].sort((a, b) => a - b);
    const mean = times.reduce((s, v) => s + v, 0) / times.length;
    const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    return { mean: Math.round(mean), p50: p(0.5), p95: p(0.95) };
}

async function call(url, key) {
    const t0 = performance.now();
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify(PAYLOAD),
            signal: AbortSignal.timeout(45000)
        });
        const ms = Math.round(performance.now() - t0);
        if (!res.ok) return { ok: false, ms, tokens: 0 };
        const body = await res.json();
        const tokens = body.usage?.completion_tokens ?? 0;
        return { ok: Boolean(body.choices?.[0]?.message?.content), ms, tokens };
    } catch {
        return { ok: false, ms: Math.round(performance.now() - t0), tokens: 0 };
    }
}

for (const router of ROUTERS) {
    for (let i = 0; i < WARMUP; i++) await call(router.url, router.key);
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await call(router.url, router.key));
    const okRuns = runs.filter((r) => r.ok);
    const latencies = okRuns.map((r) => r.ms);
    const tokensPerSec = okRuns.filter((r) => r.tokens > 0).map((r) => (r.tokens / r.ms) * 1000);
    const line = {
        router: router.name,
        model: MODEL,
        success: `${okRuns.length}/${RUNS}`,
        latency: stats(latencies),
        tokPerSec: tokensPerSec.length ? Math.round(tokensPerSec.reduce((s, v) => s + v, 0) / tokensPerSec.length) : 0
    };
    console.log(JSON.stringify(line));
}
