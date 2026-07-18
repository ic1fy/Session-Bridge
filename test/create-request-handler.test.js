import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import { createRequestHandler } from "../src/http/create-request-handler.js";

async function startTestServer(edgeManager) {
  const handler = createRequestHandler({
    edgeManager,
    requestToken: "local-secret",
    indexHtml: '<main data-request-token="__REQUEST_TOKEN__"></main>',
    assets: new Map([
      [
        "/app.js",
        { type: "text/javascript; charset=utf-8", body: "export {};" },
      ],
      [
        "/styles.css",
        { type: "text/css; charset=utf-8", body: ":root {}" },
      ],
      [
        "/favicon.svg",
        { type: "image/svg+xml; charset=utf-8", body: "<svg></svg>" },
      ],
    ]),
  });
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return {
    server,
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("serves local assets with security headers and the process token", async () => {
  const app = await startTestServer({
    openSession: async () => ({ opened: true }),
  });
  try {
    const response = await fetch(`${app.origin}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /local-secret/);
    assert.match(
      response.headers.get("content-security-policy"),
      /default-src 'self'/,
    );
    assert.equal(response.headers.get("cache-control"), "no-store");

    const script = await fetch(`${app.origin}/app.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type"), /^text\/javascript/);
    assert.equal(script.headers.get("cache-control"), "no-store");

    const styles = await fetch(`${app.origin}/styles.css`);
    assert.equal(styles.status, 200);
    assert.match(styles.headers.get("content-type"), /^text\/css/);
    assert.equal(styles.headers.get("cache-control"), "no-store");

    const icon = await fetch(`${app.origin}/favicon.svg`);
    assert.equal(icon.status, 200);
    assert.match(icon.headers.get("content-type"), /^image\/svg\+xml/);
  } finally {
    await app.close();
  }
});

test("accepts an authorized request without echoing input", async () => {
  let received;
  const app = await startTestServer({
    openSession: async (token, options) => {
      received = { token, options };
      return { opened: true };
    },
  });
  const header = Buffer.from(
    JSON.stringify({ alg: "dir", enc: "A256GCM" }),
  ).toString("base64url");
  const sessionToken = `${header}..abcdefghijklmnop.ciphertext.authenticationtag`;

  try {
    const response = await fetch(`${app.origin}/api/open-edge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: app.origin,
        "x-local-request-token": "local-secret",
      },
      body: JSON.stringify({
        sessionJson: JSON.stringify({
          sessionToken,
          expires: "2030-01-01T00:00:00.000Z",
        }),
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.deepEqual(received, {
      token: sessionToken,
      options: undefined,
    });
  } finally {
    await app.close();
  }
});

test("rejects foreign origin, missing secret, and oversized bodies", async () => {
  const app = await startTestServer({
    openSession: async () => ({ opened: true }),
  });
  try {
    const foreign = await fetch(`${app.origin}/api/open-edge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
        "x-local-request-token": "local-secret",
      },
      body: JSON.stringify({ sessionJson: "{}" }),
    });
    assert.equal(foreign.status, 403);

    const missingSecret = await fetch(`${app.origin}/api/open-edge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: app.origin,
      },
      body: JSON.stringify({ sessionJson: "{}" }),
    });
    assert.equal(missingSecret.status, 403);

    const oversized = await fetch(`${app.origin}/api/open-edge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: app.origin,
        "x-local-request-token": "local-secret",
      },
      body: JSON.stringify({ sessionJson: "x".repeat(33 * 1024) }),
    });
    assert.equal(oversized.status, 413);
  } finally {
    await app.close();
  }
});

test("returns a safe 400 for malformed request JSON", async () => {
  const app = await startTestServer({
    openSession: async () => ({ opened: true }),
  });
  try {
    const response = await fetch(`${app.origin}/api/open-edge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: app.origin,
        "x-local-request-token": "local-secret",
      },
      body: '{"private-fragment"',
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, "INVALID_JSON");
    assert.doesNotMatch(JSON.stringify(body), /private-fragment/);
  } finally {
    await app.close();
  }
});
