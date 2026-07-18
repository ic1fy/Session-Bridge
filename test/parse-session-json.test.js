import assert from "node:assert/strict";
import test from "node:test";
import { parseSessionJson } from "../src/session/parse-session-json.js";

const protectedHeader = Buffer.from(
  JSON.stringify({ alg: "dir", enc: "A256GCM" }),
).toString("base64url");
const validToken = `${protectedHeader}..abcdefghijklmnop.ciphertext.authenticationtag`;

test("extracts an unexpired five-part session JWE", () => {
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

test("rejects malformed JSON without echoing input", () => {
  assert.throws(
    () => parseSessionJson('{"sessionToken":"secret-fragment"'),
    (error) =>
      error.code === "INVALID_JSON" &&
      error.safeMessage === "粘贴内容不是有效的 JSON。" &&
      !error.safeMessage.includes("secret-fragment"),
  );
});

test("rejects missing, altered, expired, and oversized input", () => {
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
    () => parseSessionJson("x".repeat(32 * 1024 + 1)),
    (error) => error.code === "INPUT_TOO_LARGE",
  );
});
