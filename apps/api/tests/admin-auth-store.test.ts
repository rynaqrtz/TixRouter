import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { AdminAuthStore } from "../../../packages/db/src/adminAuth.js";

test("admin auth store creates one account and preserves its hash", () => {
    const store = new AdminAuthStore(new DatabaseSync(":memory:"));

    assert.equal(store.hasAdminAccount(), false);
    assert.equal(store.createAdminAccount("hash-one", 100), true);
    assert.equal(store.hasAdminAccount(), true);
    assert.equal(store.getPasswordHash(), "hash-one");
    assert.equal(store.createAdminAccount("hash-two", 200), false);
    assert.equal(store.getPasswordHash(), "hash-one");
});

test("admin auth store creates, finds, and deletes sessions", () => {
    const store = new AdminAuthStore(new DatabaseSync(":memory:"));

    store.createSession("token-hash", 100, 200);

    assert.deepEqual(store.getSession("token-hash", 150), {
        tokenHash: "token-hash",
        createdAt: 100,
        expiresAt: 200
    });
    assert.equal(store.deleteSession("token-hash"), true);
    assert.equal(store.getSession("token-hash", 150), null);

    store.createSession("expired-token-hash", 100, 200);
    assert.equal(store.getSession("expired-token-hash", 200), null);
});
