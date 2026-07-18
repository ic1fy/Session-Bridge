import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSessionCookies,
  SESSION_COOKIE_PATTERN,
} from "../src/session/build-session-cookies.js";

test("builds one secure HttpOnly cookie for a short token", () => {
  assert.deepEqual(buildSessionCookies("abc", { maxValueLength: 4 }), [
    {
      name: "__Secure-next-auth.session-token",
      value: "abc",
      domain: "chatgpt.com",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
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
});

test("keeps imported cookies session-only even when expiry is supplied", () => {
  const [cookie] = buildSessionCookies("abc", {
    expiresAt: Date.parse("2030-01-01T00:00:00.000Z"),
  });

  assert.equal(Object.hasOwn(cookie, "expires"), false);
});

test("matches only the target session-cookie family", () => {
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
