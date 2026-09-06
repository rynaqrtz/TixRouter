import { solveRegisterChallenge } from "./register-challenge.js";

const REGISTER_PATH = "/api/v0/users/register";

export async function solveRegisterPoW(targetPath: string = REGISTER_PATH): Promise<string> {
    const challenge = await solveRegisterChallenge(targetPath);
    return Buffer.from(JSON.stringify(challenge)).toString("base64");
}
