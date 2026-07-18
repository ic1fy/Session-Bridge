export const SESSION_COOKIE_BASE = "__Secure-next-auth.session-token";
export const SESSION_COOKIE_PATTERN =
  /^__Secure-next-auth\.session-token(?:\.\d+)?$/;
export const DEFAULT_MAX_COOKIE_VALUE_LENGTH = 3933;

export function buildSessionCookies(
  sessionToken,
  { maxValueLength = DEFAULT_MAX_COOKIE_VALUE_LENGTH } = {},
) {
  const values = [];
  for (let offset = 0; offset < sessionToken.length; offset += maxValueLength) {
    values.push(sessionToken.slice(offset, offset + maxValueLength));
  }

  return values.map((value, index) => ({
    name:
      values.length === 1
        ? SESSION_COOKIE_BASE
        : `${SESSION_COOKIE_BASE}.${index}`,
    value,
    domain: "chatgpt.com",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  }));
}
