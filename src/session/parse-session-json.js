import { ServiceError } from "../errors/service-error.js";

export const MAX_INPUT_BYTES = 32 * 1024;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export function parseSessionJson(text, { now = Date.now() } = {}) {
  if (
    typeof text !== "string" ||
    Buffer.byteLength(text, "utf8") > MAX_INPUT_BYTES
  ) {
    throw new ServiceError(
      "INPUT_TOO_LARGE",
      "粘贴内容超过 32 KiB 限制。",
      413,
    );
  }

  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new ServiceError("INVALID_JSON", "粘贴内容不是有效的 JSON。");
  }

  const sessionToken = document?.sessionToken;
  if (typeof sessionToken !== "string" || sessionToken.length === 0) {
    throw new ServiceError(
      "MISSING_SESSION_TOKEN",
      "JSON 中缺少 sessionToken。",
    );
  }

  const parts = sessionToken.split(".");
  const validParts =
    parts.length === 5 &&
    BASE64URL.test(parts[0]) &&
    parts[1] === "" &&
    BASE64URL.test(parts[2]) &&
    BASE64URL.test(parts[3]) &&
    BASE64URL.test(parts[4]);

  let header;
  try {
    header = JSON.parse(
      Buffer.from(parts[0] ?? "", "base64url").toString("utf8"),
    );
  } catch {
    header = null;
  }

  if (
    sessionToken.trim() !== sessionToken ||
    !validParts ||
    header?.alg !== "dir" ||
    header?.enc !== "A256GCM"
  ) {
    throw new ServiceError(
      "INVALID_SESSION_TOKEN",
      "sessionToken 不是完整、未改动的五段 JWE。",
    );
  }

  let expiresAt = null;
  if (document.expires !== undefined) {
    expiresAt = Date.parse(document.expires);
    if (!Number.isFinite(expiresAt)) {
      throw new ServiceError("INVALID_EXPIRES", "expires 不是有效时间。");
    }
    if (expiresAt <= now) {
      throw new ServiceError("SESSION_EXPIRED", "该会话已经过期。");
    }
  }

  return { sessionToken, expiresAt };
}
