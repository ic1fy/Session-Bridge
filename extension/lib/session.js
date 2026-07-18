import { BridgeError } from "./errors.js";

export const MAX_INPUT_BYTES = 32 * 1024;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function decodeProtectedHeader(value) {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const bytes = Uint8Array.from(atob(padded), (character) =>
      character.charCodeAt(0),
    );
    return JSON.parse(utf8Decoder.decode(bytes));
  } catch {
    return null;
  }
}

export function parseSessionJson(text, { now = Date.now() } = {}) {
  if (typeof text !== "string") {
    throw new BridgeError("INVALID_JSON", "粘贴内容不是有效的 JSON。");
  }
  if (utf8Encoder.encode(text).byteLength > MAX_INPUT_BYTES) {
    throw new BridgeError(
      "INPUT_TOO_LARGE",
      "粘贴内容超过 32 KiB 限制。",
    );
  }

  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new BridgeError("INVALID_JSON", "粘贴内容不是有效的 JSON。");
  }

  const sessionToken = document?.sessionToken;
  if (typeof sessionToken !== "string" || sessionToken.length === 0) {
    throw new BridgeError(
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
  const header = decodeProtectedHeader(parts[0] ?? "");

  if (
    sessionToken.trim() !== sessionToken ||
    !validParts ||
    header?.alg !== "dir" ||
    header?.enc !== "A256GCM"
  ) {
    throw new BridgeError(
      "INVALID_SESSION_TOKEN",
      "sessionToken 不是完整、未改动的五段 JWE。",
    );
  }

  let expiresAt = null;
  if (document.expires !== undefined) {
    expiresAt = Date.parse(document.expires);
    if (!Number.isFinite(expiresAt)) {
      throw new BridgeError("INVALID_EXPIRES", "expires 不是有效时间。");
    }
    if (expiresAt <= now) {
      throw new BridgeError("SESSION_EXPIRED", "该会话已经过期。");
    }
  }

  return { sessionToken, expiresAt };
}
