import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatCompletionRequest, ChatMessage, TokenSaverSettings } from "@rynarouter/types";
import {
    applyTokenSaver,
    compressFileListings,
    compressGenericLogs,
    compressGitDiff,
    compressGitStatusOrLog,
    compressGrepOutput,
    PreviewTokenSaver,
    stripAnsiCodes,
    trimMessages
} from "../src/tokenSaver.js";

const DEFAULT_SETTINGS: TokenSaverSettings = {
    enabled: true,
    compressToolOutput: {
        enabled: true,
        compressGit: true,
        compressGrep: true,
        compressFileLists: true,
        compressLogs: true,
        stripAnsiAndWhitespace: true,
        minCharacterThreshold: 10
    },
    lazySeniorDev: {
        enabled: true,
        mode: "balanced"
    },
    compressLlmOutput: {
        enabled: true,
        mode: "terse",
        stripPleasantries: true
    },
    trimMessages: {
        enabled: true,
        maxInputTokens: 8192,
        preserveTailMessages: 4
    }
};

test("stripAnsiCodes removes terminal styling codes", () => {
    const raw = "\u001b[31mError:\u001b[0m \u001b[1;32mBuild succeeded!\u001b[0m";
    const cleaned = stripAnsiCodes(raw);
    assert.equal(cleaned, "Error: Build succeeded!");
});

test("compressGitDiff removes index hashes and compacts hunk headers", () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
index 83a1b2c..94d2e3f 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -10,4 +10,5 @@ export function main() {
 const x = 1;
-const y = 2;
+const y = 3;
+const z = 4;
 return x + y;
}`;

    const compressed = compressGitDiff(diff);
    assert.ok(!compressed.includes("index 83a1b2c"));
    assert.ok(!compressed.includes("diff --git"));
    assert.ok(compressed.includes("--- src/index.ts"));
    assert.ok(compressed.includes("@@ L10 export function main() { @@"));
    assert.ok(compressed.includes("+const y = 3;"));
});

test("compressGitStatusOrLog condenses commit history and status output", () => {
    const gitLog = `commit a1b2c3d4e5f67890123456789012345678901234
Author: John Doe <john@example.com>
Date:   Mon Aug 17 20:00:00 2026 +0700

    feat: add token saver system

commit b2c3d4e5f6789012345678901234567890123456
Author: Jane Smith <jane@example.com>
Date:   Sun Aug 16 19:00:00 2026 +0700

    fix: correct provider resolver`;

    const compressedLog = compressGitStatusOrLog(gitLog);
    assert.ok(compressedLog.includes("[a1b2c3d] feat: add token saver system (John Doe)"));
    assert.ok(compressedLog.includes("[b2c3d4e] fix: correct provider resolver (Jane Smith)"));

    const gitStatus = `On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
	modified:   apps/web/src/App.tsx
	deleted:    unused.ts

Untracked files:
	new-component.tsx`;

    const compressedStatus = compressGitStatusOrLog(gitStatus);
    assert.ok(compressedStatus.includes("On branch main"));
    assert.ok(compressedStatus.includes("M apps/web/src/App.tsx"));
    assert.ok(compressedStatus.includes("D unused.ts"));
    assert.ok(compressedStatus.includes("? new-component.tsx"));
});

test("compressGrepOutput groups matches by file and cleans line indicators", () => {
    const grepOutput = `./src/index.ts:12: import { api } from "./api";
./src/index.ts:15: const client = api();
./src/utils.ts:40: export function helper() {}`;

    const compressed = compressGrepOutput(grepOutput);
    assert.ok(compressed.includes("src/index.ts:"));
    assert.ok(compressed.includes('L12: import { api } from "./api";'));
    assert.ok(compressed.includes("L15: const client = api();"));
    assert.ok(compressed.includes("src/utils.ts:"));
    assert.ok(compressed.includes("L40: export function helper() {}"));
});

test("compressFileListings compacts ls -la and tree listings", () => {
    const lsOutput = `total 32
drwxr-xr-x  12 ryna staff   384 Aug 17 20:00 src
-rw-r--r--   1 ryna staff  1024 Aug 17 19:00 package.json
-rw-r--r--   1 ryna staff   512 Aug 17 19:00 tsconfig.json`;

    const compressed = compressFileListings(lsOutput);
    assert.ok(compressed.includes("src/"));
    assert.ok(compressed.includes("package.json"));
    assert.ok(compressed.includes("tsconfig.json"));
    assert.ok(!compressed.includes("drwxr-xr-x"));
});

test("compressGenericLogs deduplicates repeated progress indicators", () => {
    const logs = `[2026-08-17 20:00:00] Building bundle...
[2026-08-17 20:00:01] Downloading assets...
[2026-08-17 20:00:02] Downloading assets...
[2026-08-17 20:00:03] Downloading assets...
[2026-08-17 20:00:04] Finished build!`;

    const compressed = compressGenericLogs(logs);
    assert.ok(compressed.includes("Building bundle..."));
    assert.ok(compressed.includes("repeated 2 more times"));
    assert.ok(compressed.includes("Finished build!"));
});

test("applyTokenSaver compresses tool messages and injects system prompts", () => {
    const request: ChatCompletionRequest = {
        model: "openai/gpt-4o",
        messages: [
            {
                role: "user",
                content: "Please check git status and optimize code."
            },
            {
                role: "tool",
                content: `diff --git a/file.ts b/file.ts
index 1111111..2222222 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line 1
+added line
 line 3`
            }
        ]
    };

    const result = applyTokenSaver(request, DEFAULT_SETTINGS);

    // Verify tool content was compressed
    const toolMsg = result.request.messages.find((m) => m.role === "tool");
    assert.ok(toolMsg);
    assert.ok(!String(toolMsg.content).includes("index 1111111"));
    assert.ok(String(toolMsg.content).includes("--- file.ts"));

    // Verify system prompt was injected with Lazy Senior Dev and Caveman mode
    const systemMsg = result.request.messages.find((m) => m.role === "system");
    assert.ok(systemMsg);
    assert.ok(String(systemMsg.content).includes("LAZY SENIOR DEV"));
    assert.ok(String(systemMsg.content).includes("YAGNI"));
    assert.ok(String(systemMsg.content).includes("TERSE OUTPUT MODE"));

    assert.ok(result.tokensSaved > 0);
    assert.ok(result.percentageSaved >= 0);
});

test("previewTokenSaver returns accurate before and after token simulation", () => {
    const rawDiff = `diff --git a/app.ts b/app.ts
index 1234567..7654321 100644
--- a/app.ts
+++ b/app.ts
@@ -10,3 +10,4 @@
 test content
+extra line
 end content`;

    const preview = PreviewTokenSaver("tool_output", rawDiff, DEFAULT_SETTINGS);
    assert.equal(preview.originalText, rawDiff);
    assert.ok(preview.transformedText.length < preview.originalText.length);
    assert.ok(preview.transformedTokensEstimate < preview.originalTokensEstimate);
    assert.ok(preview.tokensSavedEstimate > 0);
    assert.ok(preview.percentageSaved > 0);
});

test("trimMessages is a no-op when total fits under the threshold", () => {
    const messages: ChatMessage[] = [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" }
    ];

    const result = trimMessages(messages, { enabled: true, maxInputTokens: 1000, preserveTailMessages: 2 });
    assert.equal(result.trimmedCount, 0);
    assert.deepEqual(result.messages, messages);
});

test("trimMessages drops oldest tool messages until under threshold and preserves tail", () => {
    const huge = "x".repeat(2000);
    const messages: ChatMessage[] = [
        { role: "system", content: "sys" },
        { role: "user", content: "first" },
        { role: "tool", tool_call_id: "t1", content: huge },
        { role: "tool", tool_call_id: "t2", content: huge },
        { role: "tool", tool_call_id: "t3", content: huge },
        { role: "tool", tool_call_id: "t4", content: huge },
        { role: "assistant", content: "ok" },
        { role: "user", content: "next?" }
    ];

    const result = trimMessages(messages, { enabled: true, maxInputTokens: 500, preserveTailMessages: 2 });

    assert.ok(result.trimmedCount >= 1);
    assert.ok(result.trimmedTokens <= 500);

    const trimmedToolMsg = result.messages.find((m) => m.role === "tool" && m.tool_call_id === "t1");
    assert.ok(trimmedToolMsg);
    assert.notEqual(String(trimmedToolMsg.content), huge);
    assert.equal(String(trimmedToolMsg.content), "[trimmed: tool output omitted to fit context window]");

    const lastUser = result.messages[result.messages.length - 1];
    assert.equal(lastUser?.role, "user");
    assert.equal(String(lastUser?.content), "next?");
});

test("trimMessages leaves non-tail tool messages untouched when over budget", () => {
    const huge = "y".repeat(4000);
    const messages: ChatMessage[] = [
        { role: "system", content: "sys" },
        { role: "user", content: "u" },
        { role: "tool", tool_call_id: "t1", content: huge },
        { role: "tool", tool_call_id: "t2", content: huge },
        { role: "tool", tool_call_id: "t3", content: huge },
        { role: "assistant", content: "a" }
    ];

    const result = trimMessages(messages, { enabled: true, maxInputTokens: 500, preserveTailMessages: 2 });

    const lastTool = result.messages.find((m) => m.role === "tool" && m.tool_call_id === "t3");
    assert.ok(lastTool);
    assert.equal(String(lastTool.content), huge, "t3 should be inside tail and not trimmed");
    assert.ok(result.trimmedCount >= 1);
});

test("applyTokenSaver runs trimMessages after compression", () => {
    const longDiff = `diff --git a/big.ts b/big.ts\n` + `+line\n`.repeat(500);
    const messages: ChatMessage[] = [
        { role: "system", content: "sys" },
        { role: "user", content: "u" },
        { role: "tool", tool_call_id: "a", content: longDiff },
        { role: "tool", tool_call_id: "b", content: longDiff },
        { role: "tool", tool_call_id: "c", content: longDiff },
        { role: "assistant", content: "ok" }
    ];

    const request: ChatCompletionRequest = { model: "openai/gpt-4o", messages };
    const settings: TokenSaverSettings = {
        ...DEFAULT_SETTINGS,
        trimMessages: { enabled: true, maxInputTokens: 200, preserveTailMessages: 1 }
    };

    const result = applyTokenSaver(request, settings);
    const totalChars = result.request.messages.reduce(
        (acc, m) => acc + (typeof m.content === "string" ? m.content.length : 0),
        0
    );
    assert.ok(Math.ceil(totalChars / 4) <= 200);
});
