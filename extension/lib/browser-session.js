import { BridgeError } from "./errors.js";
import {
  buildSessionCookies,
  SESSION_COOKIE_PATTERN,
} from "./session-cookies.js";

export const CHATGPT_HOME_URL = "https://chatgpt.com/";
export const CHATGPT_SESSION_URL =
  "https://chatgpt.com/api/auth/session";
export const MANAGED_SESSION_KEY = "managedSession";
const VERIFY_TIMEOUT_MS = 15_000;

function cookieRemovalUrl(cookie) {
  const protocol = cookie.secure ? "https:" : "http:";
  const hostname = cookie.domain.replace(/^\./, "");
  const path = cookie.path?.startsWith("/") ? cookie.path : "/";
  return `${protocol}//${hostname}${path}`;
}

async function clearSessionCookies(browser, storeId) {
  const cookies = await browser.cookies.getAll({
    domain: "chatgpt.com",
    storeId,
  });
  const targets = cookies.filter(({ name }) =>
    SESSION_COOKIE_PATTERN.test(name),
  );

  await Promise.all(
    targets.map((cookie) => {
      const details = {
        url: cookieRemovalUrl(cookie),
        name: cookie.name,
        storeId,
      };
      if (cookie.partitionKey) {
        details.partitionKey = cookie.partitionKey;
      }
      return browser.cookies.remove(details);
    }),
  );
}

async function writeSessionCookies(browser, storeId, sessionToken) {
  for (const cookie of buildSessionCookies(sessionToken)) {
    await browser.cookies.set({
      url: CHATGPT_HOME_URL,
      ...cookie,
      storeId,
    });
  }
}

function waitForTabComplete(browser, tabId, timeoutMs, signal) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      clearTimeout(timeout);
      browser.tabs.onUpdated.removeListener(onUpdated);
      signal.removeEventListener("abort", onAbort);
    }

    function onAbort() {
      cleanup();
      reject(new Error("Verification navigation was cancelled."));
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while waiting for the verification tab."));
    }, timeoutMs);

    function onUpdated(updatedTabId, changeInfo, tab) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      // The initial about:blank page can finish after this listener is added.
      if (tab?.url !== CHATGPT_SESSION_URL) return;
      cleanup();
      resolve();
    }

    browser.tabs.onUpdated.addListener(onUpdated);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function verifyLoadedSession(browser, tabId) {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    func: () => {
      try {
        const documentValue = JSON.parse(
          globalThis.document?.body?.textContent ?? "",
        );
        return Boolean(
          documentValue?.user && typeof documentValue.user === "object",
        );
      } catch {
        return false;
      }
    },
  });
  return results?.[0]?.result === true;
}

async function rollbackCreatedSession(browser, { windowId, storeId }) {
  if (storeId) {
    await clearSessionCookies(browser, storeId).catch(() => {});
  }
  await browser.storage.session.remove(MANAGED_SESSION_KEY).catch(() => {});
  if (windowId !== null) {
    await browser.windows.remove(windowId).catch(() => {});
  }
}

function normalizeError(error) {
  if (error instanceof BridgeError) return error;
  return new BridgeError(
    "OPEN_SESSION_FAILED",
    "无法打开隔离会话，请重试。",
  );
}

export async function openIsolatedSession(
  sessionToken,
  {
    browser,
    waitForTab = waitForTabComplete,
    verifyTab = verifyLoadedSession,
  },
) {
  const allowed = await browser.extension
    .isAllowedIncognitoAccess()
    .catch(() => false);
  if (!allowed) {
    throw new BridgeError(
      "INPRIVATE_NOT_ALLOWED",
      "请在扩展详情中开启无痕模式访问权限后重试。",
    );
  }

  let existingWindows;
  try {
    existingWindows = await browser.windows.getAll();
  } catch {
    throw new BridgeError(
      "WINDOW_INSPECTION_FAILED",
      "无法检查浏览器窗口状态，请重试。",
    );
  }
  if (existingWindows.some(({ incognito }) => incognito)) {
    throw new BridgeError(
      "INPRIVATE_BUSY",
      "请先关闭其他无痕窗口，避免登录状态互相影响。",
    );
  }

  let windowId = null;
  let storeId = null;

  try {
    let createdWindow;
    try {
      createdWindow = await browser.windows.create({
        url: "about:blank",
        incognito: true,
        focused: true,
      });
    } catch {
      throw new BridgeError(
        "WINDOW_OPEN_FAILED",
        "无法创建无痕窗口。",
      );
    }

    windowId = createdWindow?.id ?? null;
    if (windowId === null) {
      throw new BridgeError(
        "WINDOW_OPEN_FAILED",
        "无法创建无痕窗口。",
      );
    }

    const tabs =
      createdWindow.tabs?.length > 0
        ? createdWindow.tabs
        : await browser.tabs.query({ windowId });
    const tabId = tabs[0]?.id;
    if (!Number.isInteger(tabId)) {
      throw new BridgeError(
        "TAB_NOT_FOUND",
        "无法定位新建的无痕页签。",
      );
    }

    const stores = await browser.cookies.getAllCookieStores();
    storeId = stores.find(({ tabIds }) => tabIds.includes(tabId))?.id ?? null;
    if (!storeId) {
      throw new BridgeError(
        "COOKIE_STORE_NOT_FOUND",
        "无法定位无痕 Cookie 存储。",
      );
    }

    await browser.storage.session.set({
      [MANAGED_SESSION_KEY]: { windowId, storeId },
    });

    try {
      await clearSessionCookies(browser, storeId);
      await writeSessionCookies(browser, storeId, sessionToken);
    } catch {
      throw new BridgeError(
        "COOKIE_WRITE_FAILED",
        "无法写入 ChatGPT 会话 Cookie。",
      );
    }

    let accepted;
    const verification = new AbortController();
    try {
      const tabReady = waitForTab(
        browser, tabId, VERIFY_TIMEOUT_MS, verification.signal,
      );
      await Promise.all([
        tabReady,
        browser.tabs.update(tabId, { url: CHATGPT_SESSION_URL }),
      ]);
      accepted = await verifyTab(browser, tabId);
    } catch {
      throw new BridgeError(
        "SESSION_VERIFICATION_FAILED",
        "无法连接 ChatGPT 验证会话。",
      );
    } finally {
      verification.abort();
    }
    if (!accepted) {
      throw new BridgeError(
        "SESSION_REJECTED",
        "ChatGPT 未接受该会话，请重新复制未过期的完整 JSON。",
      );
    }

    try {
      await browser.tabs.update(tabId, { url: CHATGPT_HOME_URL });
    } catch {
      throw new BridgeError(
        "NAVIGATION_FAILED",
        "会话已验证，但无法打开 ChatGPT。",
      );
    }

    return { opened: true, windowId, tabId };
  } catch (error) {
    await rollbackCreatedSession(browser, { windowId, storeId });
    throw normalizeError(error);
  }
}

export async function cleanupManagedSession(windowId, { browser }) {
  const stored = await browser.storage.session.get(MANAGED_SESSION_KEY);
  const state = stored[MANAGED_SESSION_KEY];
  if (!state || state.windowId !== windowId) return false;

  try {
    await clearSessionCookies(browser, state.storeId);
  } finally {
    await browser.storage.session.remove(MANAGED_SESSION_KEY);
  }
  return true;
}
