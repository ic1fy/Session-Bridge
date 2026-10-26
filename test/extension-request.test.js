import assert from "node:assert/strict";
import test from "node:test";
import { createSessionRequestHandler } from "../extension/lib/session-request.js";

const browser = {
  runtime: { id: "test-extension", getURL: (path) => `chrome-extension://test-extension/${path}` },
};
const sender = { id: browser.runtime.id, url: browser.runtime.getURL("popup.html") };
const header = Buffer.from(JSON.stringify({ alg: "dir", enc: "A256GCM" })).toString("base64url");
const request = { type: "OPEN_SESSION", sessionToken: `${header}..iv.ciphertext.tag` };

test("rejects foreign senders and malformed tokens before opening a window", async () => {
  let opened = 0;
  const handle = createSessionRequestHandler(browser, async () => { opened++; });
  assert.equal((await handle(request, { ...sender, id: "other" })).code, "INVALID_SESSION_REQUEST");
  assert.equal((await handle(request, { ...sender, url: "https://chatgpt.com/" })).code, "INVALID_SESSION_REQUEST");
  assert.equal((await handle({ ...request, sessionToken: "invalid" }, sender)).code, "INVALID_SESSION_TOKEN");
  assert.equal(opened, 0);
});

test("blocks overlapping imports and accepts the next request after completion", async () => {
  let finish;
  let opened = 0;
  const handle = createSessionRequestHandler(browser, async () => {
    opened++;
    if (opened === 1) await new Promise((resolve) => { finish = resolve; });
  });
  const first = handle(request, sender);
  assert.equal((await handle(request, sender)).code, "SESSION_OPENING");
  assert.equal(opened, 1);
  finish();
  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(await handle(request, sender), { ok: true });
  assert.equal(opened, 2);
});

test("releases the import lock after failure without returning internal error details", async () => {
  let opened = 0;
  const handle = createSessionRequestHandler(browser, async () => {
    if (++opened === 1) throw new Error("private credential details");
  });
  const result = await handle(request, sender);
  assert.equal(result.code, "OPEN_SESSION_FAILED");
  assert.doesNotMatch(JSON.stringify(result), /private credential/);
  assert.deepEqual(await handle(request, sender), { ok: true });
});
