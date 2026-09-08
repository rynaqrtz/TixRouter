const ROUTERS = [
    { name: "TixRouter", url: "http://127.0.0.1:20130/v1/chat/completions", key: process.env.TIX_KEY, model: (m) => m },
    { name: "9Router", url: "http://127.0.0.1:20128/v1/chat/completions", key: "sk-7a7511e8df41d739-0roguh-e4fbe7e0", model: (m) => `openrouter/${m}` }
];

const MODEL = process.argv[2];
const RUNS = 6;
const INTER_CALL_DELAY_MS = 8000;
const ROUTER_GAP_MS = 60000;
const PAYLOAD = {
    messages: [{ role: "user", content: "Explain in one paragraph what an API gateway is and why it matters for LLM apps." }],
    max_tokens: 500,
    temperature: 0
};

function stats(times) {
    const sorted = [...times].sort((a, b) => a - b);
    const mean = times.reduce((s, v) => s + v, 0) / times.length;
    const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    return { mean: Math.round(mean), p50: p(0.5), p95: p(0.95) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(router) {
    const t0 = performance.now();
    try {
        const res = await fetch(router.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${router.key}` },
            body: JSON.stringify({ ...PAYLOAD, model: router.model(MODEL) }),
            signal: AbortSignal.timeout(90000)
        });
        const ms = Math.round(performance.now() - t0);
        if (!res.ok) {
            const snippet = (await res.text().catch(() => "")).slice(0, 120);
            return { ok: false, ms, tokens: 0, status: res.status, snippet };
        }
        const text = await res.text();
        let body;
        try {
            body = JSON.parse(text);
        } catch {
            const start = text.indexOf("{");
            const end = text.lastIndexOf("}");
            if (start < 0 || end <= start) return { ok: false, ms, tokens: 0, status: res.status, snippet: text.slice(0, 120) };
            try {
                body = JSON.parse(text.slice(start, end + 1));
            } catch {
                return { ok: false, ms, tokens: 0, status: res.status, snippet: text.slice(0, 120) };
            }
        }
        const tokens = body.usage?.completion_tokens ?? 0;
        const content = body.choices?.[0]?.message?.content;
        if (!content) return { ok: false, ms, tokens, status: 200, snippet: JSON.stringify(body).slice(0, 120) };
        return { ok: true, ms, tokens, status: res.status };
    } catch (e) {
        return { ok: false, ms: Math.round(performance.now() - t0), tokens: 0, status: 0, snippet: `${e?.name}: ${e?.message}` };
    }
}

const ONLY = process.env.ROUTER;
let first = true;
for (const router of ROUTERS) {
    if (ONLY && router.name !== ONLY) continue;
    if (!first) await sleep(ROUTER_GAP_MS);
    first = false;
    await call(router);
    await sleep(INTER_CALL_DELAY_MS);
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
        runs.push(await call(router));
        if (i < RUNS - 1) await sleep(INTER_CALL_DELAY_MS);
    }
    const okRuns = runs.filter((r) => r.ok);
    const latencies = okRuns.map((r) => r.ms);
    const tokensPerSec = okRuns.filter((r) => r.tokens > 0).map((r) => (r.tokens / r.ms) * 1000);
    const failed = runs.filter((r) => !r.ok).map((r) => r.status);
    console.log(JSON.stringify({
        router: router.name,
        model: MODEL,
        success: `${okRuns.length}/${RUNS}`,
        failedStatus: failed.length ? failed : undefined,
        sampleFail: runs.find((r) => !r.ok)?.snippet,
        latency: stats(latencies),
        tokPerSec: tokensPerSec.length ? Math.round(tokensPerSec.reduce((s, v) => s + v, 0) / tokensPerSec.length) : 0
    }));
}
