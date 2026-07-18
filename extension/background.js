import {
  cleanupManagedSession,
  openIsolatedSession,
} from "./lib/browser-session.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "OPEN_SESSION") return false;
  if (typeof message.sessionToken !== "string") {
    sendResponse({
      ok: false,
      code: "INVALID_SESSION_REQUEST",
      error: "会话请求无效，请重新粘贴完整 JSON。",
    });
    return false;
  }

  openIsolatedSession(message.sessionToken, { browser: chrome })
    .then(() => sendResponse({ ok: true }))
    .catch((error) =>
      sendResponse({
        ok: false,
        code: error.code ?? "OPEN_SESSION_FAILED",
        error: error.safeMessage ?? "无法打开隔离会话。",
      }),
    );
  return true;
});

chrome.windows.onRemoved.addListener((windowId) => {
  void cleanupManagedSession(windowId, { browser: chrome }).catch(() => {});
});
