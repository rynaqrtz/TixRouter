import crypto from "node:crypto";

const CHAT = "https://chat.deepseek.com";
const AUTH = "https://platform.deepseek.com/auth-api/v0/users";
const TARGET = "/api/v0/users/register";

const IOS_UAS = [
    "DeepSeek/2 CFNetwork/1568.100.1 Darwin/24.0.0",
    "DeepSeek/2.1 CFNetwork/1568.100.1 Darwin/24.0.0",
    "DeepSeek/2 CFNetwork/1490.0.4 Darwin/23.4.0"
];
const IOS_VERSIONS = ["2.0.4", "2.1.0", "2.0.2"];

function iosHeaders(): Record<string, string> {
    return {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": IOS_UAS[Math.floor(Math.random() * IOS_UAS.length)]!,
        "x-client-bundle-id": "com.deepseek.chat",
        "x-client-locale": "id_ID",
        "x-client-platform": "ios",
        "x-client-timezone-offset": "25200",
        "x-client-version": IOS_VERSIONS[Math.floor(Math.random() * IOS_VERSIONS.length)]!,
        "x-rangers-id": String(10 ** 18 + Math.floor(Math.random() * 9 * 10 ** 18))
    };
}

function guestHeaders(): Record<string, string> {
    return {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0",
        origin: "https://platform.deepseek.com",
        referer: "https://platform.deepseek.com/sign_up",
        "x-client-bundle-id": "com.deepseek.chat",
        "x-client-locale": "id_ID",
        "x-client-platform": "web",
        "x-client-timezone-offset": "25200",
        "x-client-version": "1.0.0",
        "x-rangers-id": String(10 ** 18 + Math.floor(Math.random() * 9 * 10 ** 18))
    };
}

async function solveGuestPow(targetPath: string): Promise<string> {
    const { solveRegisterPoW } = await import("../packages/executors/dist/register-pow.js");
    return solveRegisterPoW(targetPath);
}

async function post(url: string, body: Record<string, unknown>, headers: Record<string, string>): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    let json: Record<string, unknown> = {};
    try {
        json = (await res.json()) as Record<string, unknown>;
    } catch {}
    return { status: res.status, json };
}

function bizData(json: Record<string, unknown>): Record<string, unknown> | null {
    const data = json.data as Record<string, unknown> | undefined;
    return (data?.biz_data as Record<string, unknown> | undefined) ?? null;
}

function bizError(json: Record<string, unknown>): string {
    const data = json.data as Record<string, unknown> | undefined;
    return String(data?.biz_msg ?? json.msg ?? "unknown error");
}

async function main(): Promise<void> {
    const email = process.env.DS_EMAIL!;
    const password = process.env.DS_PASS!;
    const deviceId = Buffer.from(crypto.randomBytes(32)).toString("base64");
    const { DeepSeekFreeExecutor } = await import("../packages/executors/dist/deepseek-free.js");

    console.log("[1] guest PoW challenge...");
    const guestChallenge = await post(`${AUTH}/create_guest_challenge`, { target_path: TARGET }, guestHeaders());
    if (guestChallenge.json.code !== 0) throw new Error(`challenge: ${bizError(guestChallenge.json)}`);
    const pow = await solveGuestPow(TARGET);
    console.log("    pow ok:", pow.slice(0, 30) + "...");

    console.log("[2] sending email verification code...");
    const codeRes = await post(
        `${AUTH}/create_email_verification_code`,
        { email, turnstile_token: "", locale: "id_ID", device_id: deviceId, scenario: "register" },
        guestHeaders()
    );
    if (codeRes.json.code !== 0) throw new Error(`send code: ${bizError(codeRes.json)}`);
    console.log("    code sent");

    console.log("[3] reading code from mail.tm...");
    const mailToken = process.env.MAILTM_TOKEN!;
    let code: string | null = null;
    for (let i = 0; i < 12 && !code; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const res = await fetch("https://api.mail.tm/messages", { headers: { authorization: `Bearer ${mailToken}` } });
        const messages = (await res.json()) as { "hydra:member"?: Array<{ id: string }> };
        for (const msg of messages["hydra:member"] ?? []) {
            const full = (await (await fetch(`https://api.mail.tm/messages/${msg.id}`, { headers: { authorization: `Bearer ${mailToken}` } })).json()) as {
                text?: string;
                html?: string[];
            };
            const text = `${full.text ?? ""} ${(full.html ?? []).join(" ")}`;
            const match = text.match(/(?<!\d)(\d{6})(?!\d)/);
            if (match) {
                code = match[1]!;
                break;
            }
        }
        console.log(`    poll ${i + 1}: ${code ?? "no code yet"}`);
    }
    if (!code) throw new Error("verification code not received");
    console.log("    code:", code);

    console.log("[4] registering...");
    const reg = await post(
        `${AUTH}/register`,
        {
            region: "US",
            locale: "id_ID",
            device_id: deviceId,
            payload: { email, email_verification_code: code, password },
            os: "ios"
        },
        { ...iosHeaders(), "x-ds-guest-pow-response": pow }
    );
    if (reg.json.code !== 0) throw new Error(`register: ${bizError(reg.json)}`);
    const regToken = (bizData(reg.json) as { user?: { token?: string } } | null)?.user?.token;
    console.log("    registered, platform token:", regToken ? regToken.slice(0, 20) + "..." : "MISSING");

    console.log("[5] chat login via executor...");
    const exec = new DeepSeekFreeExecutor({ email, password });
    await (exec as unknown as { ensureToken(): Promise<void> }).ensureToken();
    console.log("    chat token ok");

    console.log("[6] completions on 4 models...");
    const models = ["dsfree/deepseek-v3", "dsfree/deepseek-r1", "dsfree/deepseek-v4-flash", "dsfree/deepseek-v4-pro"];
    for (const model of models) {
        try {
            const content: string[] = [];
            const reasoning: string[] = [];
            for await (const chunk of exec.chatCompletionStream({
                model,
                messages: [{ role: "user", content: "Reply with exactly: TixRouter OK" }]
            })) {
                const delta = chunk.choices[0]?.delta;
                if (delta?.content) content.push(delta.content);
                if (delta?.reasoning_content) reasoning.push(delta.reasoning_content);
            }
            const r = reasoning.join("").trim();
            console.log(`    ${model}: "${content.join("").trim().slice(0, 60)}"${r ? ` (reasoning: ${r.length} chars)` : ""}`);
        } catch (err) {
            console.log(`    ${model}: ERROR ${(err as Error).message.slice(0, 120)}`);
        }
    }
}

main().catch((err) => {
    console.error("E2E failed:", (err as Error).message);
    process.exit(1);
});
