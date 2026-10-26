import assert from "node:assert/strict";
import test from "node:test";
import { BridgeError } from "../extension/lib/errors.js";
import {
  MAX_INPUT_BYTES,
  parseSessionJson,
} from "../extension/lib/session.js";
import {
  buildSessionCookies,
  SESSION_COOKIE_PATTERN,
} from "../extension/lib/session-cookies.js";

const protectedHeader = Buffer.from(
  JSON.stringify({ alg: "dir", enc: "A256GCM" }),
).toString("base64url");
const validToken = `${protectedHeader}..abcdefghijklmnop.ciphertext.authenticationtag`;

test("extracts an unexpired five-part JWE without retaining other fields", () => {
  const result = parseSessionJson(
    JSON.stringify({
      sessionToken: validToken,
      expires: "2030-01-01T00:00:00.000Z",
      accessToken: "ignored",
      user: { email: "ignored@example.com" },
    }),
    { now: Date.parse("2029-01-01T00:00:00.000Z") },
  );

  assert.deepEqual(result, {
    sessionToken: validToken,
    expiresAt: Date.parse("2030-01-01T00:00:00.000Z"),
  });
});

test("uses safe coded errors without echoing malformed input", () => {
  assert.throws(
    () => parseSessionJson('{"sessionToken":"secret-fragment"'),
    (error) =>
      error instanceof BridgeError &&
      error.code === "INVALID_JSON" &&
      error.safeMessage === "粘贴内容不是有效的 JSON。" &&
      !error.safeMessage.includes("secret-fragment"),
  );
});

test("rejects missing, altered, expired, and invalid-expiry sessions", () => {
  assert.throws(
    () => parseSessionJson("{}"),
    (error) => error.code === "MISSING_SESSION_TOKEN",
  );
  assert.throws(
    () => parseSessionJson(JSON.stringify({ sessionToken: `${validToken} ` })),
    (error) => error.code === "INVALID_SESSION_TOKEN",
  );
  assert.throws(
    () =>
      parseSessionJson(
        JSON.stringify({
          sessionToken: validToken,
          expires: "2020-01-01T00:00:00.000Z",
        }),
        { now: Date.parse("2021-01-01T00:00:00.000Z") },
      ),
    (error) => error.code === "SESSION_EXPIRED",
  );
  assert.throws(
    () =>
      parseSessionJson(
        JSON.stringify({ sessionToken: validToken, expires: "not-a-date" }),
      ),
    (error) => error.code === "INVALID_EXPIRES",
  );
});

test("enforces the 128 KiB limit by UTF-8 bytes", () => {
  assert.equal(MAX_INPUT_BYTES, 128 * 1024);
  assert.throws(
    () => parseSessionJson("你".repeat(Math.ceil(MAX_INPUT_BYTES / 3) + 1)),
    (error) => error.code === "INPUT_TOO_LARGE",
  );
});

test("builds one secure session cookie for a short token", () => {
  assert.deepEqual(buildSessionCookies("abc", { maxValueLength: 4 }), [
    {
      name: "__Secure-next-auth.session-token",
      value: "abc",
      domain: "chatgpt.com",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    },
  ]);
});

test("chunks a long token in stable numeric order", () => {
  const cookies = buildSessionCookies("abcdefghij", { maxValueLength: 4 });

  assert.deepEqual(
    cookies.map(({ name, value }) => ({ name, value })),
    [
      { name: "__Secure-next-auth.session-token.0", value: "abcd" },
      { name: "__Secure-next-auth.session-token.1", value: "efgh" },
      { name: "__Secure-next-auth.session-token.2", value: "ij" },
    ],
  );
  assert.equal(cookies.every((cookie) => !("expirationDate" in cookie)), true);
});

test("matches only the imported session cookie family", () => {
  assert.equal(
    SESSION_COOKIE_PATTERN.test("__Secure-next-auth.session-token"),
    true,
  );
  assert.equal(
    SESSION_COOKIE_PATTERN.test("__Secure-next-auth.session-token.12"),
    true,
  );
  assert.equal(
    SESSION_COOKIE_PATTERN.test("__Secure-authjs.session-token.0"),
    false,
  );
  assert.equal(SESSION_COOKIE_PATTERN.test("other-cookie"), false);
});
