export async function generateBrowserPKCE() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const codeVerifier = base64UrlEncode(array);

    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const codeChallenge = base64UrlEncode(new Uint8Array(digest));

    const stateArray = new Uint8Array(16);
    window.crypto.getRandomValues(stateArray);
    const state = base64UrlEncode(stateArray);

    return { codeVerifier, codeChallenge, state };
}

function base64UrlEncode(buffer: Uint8Array): string {
    let str = "";
    for (let i = 0; i < buffer.length; i++) {
        str += String.fromCharCode(buffer[i]);
    }
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
