import { BridgeError } from "./errors.js";
import { parseSessionJson } from "./session.js";
import { openIsolatedSession } from "./browser-session.js";

// One handler per service worker prevents overlapping popup submissions.
export function createSessionRequestHandler(browser, openSession = openIsolatedSession) {
  let opening = false;

  return async function handleSessionRequest(message, sender) {
    try {
      if (
        sender?.id !== browser.runtime.id ||
        sender?.url !== browser.runtime.getURL("popup.html") ||
        message?.type !== "OPEN_SESSION" ||
        typeof message.sessionToken !== "string"
      ) {
        throw new BridgeError("INVALID_SESSION_REQUEST", "会话请求无效，请重新粘贴完整 JSON。");
      }
      const { sessionToken } = parseSessionJson(JSON.stringify({
        sessionToken: message.sessionToken,
      }));
      if (opening) {
        throw new BridgeError("SESSION_OPENING", "正在打开会话，请稍候。");
      }

      opening = true;
      try {
        await openSession(sessionToken, { browser });
        return { ok: true };
      } finally {
        opening = false;
      }
    } catch (error) {
      return {
        ok: false,
        code: error instanceof BridgeError ? error.code : "OPEN_SESSION_FAILED",
        error: error instanceof BridgeError ? error.safeMessage : "无法打开隔离会话。",
      };
    }
  };
}
