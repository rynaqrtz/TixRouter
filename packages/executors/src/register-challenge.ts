import { solvePoW, type PowChallenge } from "./deepseek-scraper.js";

const AUTH_BASE = "https://platform.deepseek.com/auth-api/v0/users";

export interface RegisterChallengeResult extends Record<string, unknown> {
    algorithm: string;
    challenge: string;
    salt: string;
    answer: number;
    signature: string;
}

function guestHeaders(): Record<string, string> {
    return {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0",
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

export async function solveRegisterChallenge(targetPath: string): Promise<RegisterChallengeResult> {
    const res = await fetch(`${AUTH_BASE}/create_guest_challenge`, {
        method: "POST",
        headers: guestHeaders(),
        body: JSON.stringify({ target_path: targetPath })
    });
    const json = (await res.json()) as {
        code?: number;
        msg?: string;
        data?: { biz_data?: { guest_challenge?: PowChallenge } };
    };
    const challenge = json.data?.biz_data?.guest_challenge;
    if (!challenge) {
        throw new Error(`No register PoW challenge: ${json.msg ?? `HTTP ${res.status}`}`);
    }
    const solved = (await solvePoW(challenge)) as RegisterChallengeResult;
    return solved;
}
