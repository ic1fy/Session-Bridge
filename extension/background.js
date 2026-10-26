import { cleanupManagedSession } from "./lib/browser-session.js";
import { createSessionRequestHandler } from "./lib/session-request.js";

const handleSessionRequest = createSessionRequestHandler(chrome);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "OPEN_SESSION") return false;
  void handleSessionRequest(message, sender).then(sendResponse);
  return true;
});

chrome.windows.onRemoved.addListener((windowId) => {
  void cleanupManagedSession(windowId, { browser: chrome }).catch(() => {});
});
