import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupManagedSession,
  openIsolatedSession,
} from "../extension/lib/browser-session.js";

const SESSION_COOKIE = "__Secure-next-auth.session-token";

function createFakeBrowser({
  incognitoAllowed = true,
  windows = [],
  cookieStores = [{ id: "private-store", tabIds: [50] }],
  storedState = {},
  cookies = [
    {
      name: `${SESSION_COOKIE}.0`,
      domain: ".chatgpt.com",
      path: "/",
      secure: true,
      storeId: "private-store",
    },
    {
      name: "unrelated-cookie",
      domain: ".chatgpt.com",
      path: "/",
      secure: true,
      storeId: "private-store",
    },
  ],
} = {}) {
  const calls = [];
  const sessionState = { ...storedState };

  const browser = {
    extension: {
      isAllowedIncognitoAccess: async () => {
        calls.push(["extension.isAllowedIncognitoAccess"]);
        return incognitoAllowed;
      },
    },
    windows: {
      getAll: async () => {
        calls.push(["windows.getAll"]);
        return windows;
      },
      create: async (details) => {
        calls.push(["windows.create", details]);
        return { id: 40, incognito: true, tabs: [{ id: 50 }] };
      },
      remove: async (windowId) => {
        calls.push(["windows.remove", windowId]);
      },
    },
    tabs: {
      query: async (details) => {
        calls.push(["tabs.query", details]);
        return [{ id: 50 }];
      },
      update: async (tabId, details) => {
        calls.push(["tabs.update", tabId, details]);
        return { id: tabId, ...details };
      },
    },
    cookies: {
      getAllCookieStores: async () => {
        calls.push(["cookies.getAllCookieStores"]);
        return cookieStores;
      },
      getAll: async (details) => {
        calls.push(["cookies.getAll", details]);
        return cookies;
      },
      remove: async (details) => {
        calls.push(["cookies.remove", details]);
        return details;
      },
      set: async (details) => {
        calls.push(["cookies.set", details]);
        return details;
      },
    },
    storage: {
      session: {
        get: async (key) => {
          calls.push(["storage.session.get", key]);
          return { [key]: sessionState[key] };
        },
        set: async (value) => {
          calls.push(["storage.session.set", value]);
          Object.assign(sessionState, value);
        },
        remove: async (key) => {
          calls.push(["storage.session.remove", key]);
          delete sessionState[key];
        },
      },
    },
  };

  return { browser, calls, sessionState };
}

test("requires explicit InPrivate access before creating a window", async () => {
  const fake = createFakeBrowser({ incognitoAllowed: false });

  await assert.rejects(
    openIsolatedSession("abc", { browser: fake.browser }),
    (error) =>
      error.code === "INPRIVATE_NOT_ALLOWED" &&
      error.safeMessage.includes("无痕模式"),
  );
  assert.deepEqual(fake.calls, [["extension.isAllowedIncognitoAccess"]]);
});

test("refuses to share the cookie store with an existing InPrivate window", async () => {
  const fake = createFakeBrowser({
    windows: [{ id: 9, incognito: true }],
  });

  await assert.rejects(
    openIsolatedSession("abc", { browser: fake.browser }),
    (error) => error.code === "INPRIVATE_BUSY",
  );
  assert.equal(
    fake.calls.some(([name]) => name === "windows.create"),
    false,
  );
});

test("clears, writes, verifies, and reuses one InPrivate tab", async () => {
  const fake = createFakeBrowser();

  const result = await openIsolatedSession("abc", {
    browser: fake.browser,
    waitForTab: async (browser, tabId) => {
      assert.equal(browser, fake.browser);
      assert.equal(tabId, 50);
      fake.calls.push(["waitForTab", tabId]);
    },
    verifyTab: async (browser, tabId) => {
      assert.equal(browser, fake.browser);
      assert.equal(tabId, 50);
      fake.calls.push(["verifyTab", tabId]);
      return true;
    },
  });

  assert.deepEqual(result, { opened: true, windowId: 40, tabId: 50 });
  assert.deepEqual(fake.sessionState.managedSession, {
    windowId: 40,
    storeId: "private-store",
  });
  assert.deepEqual(
    fake.calls.find(([name]) => name === "windows.create"),
    [
      "windows.create",
      {
        url: "about:blank",
        incognito: true,
        focused: true,
      },
    ],
  );

  const targetRemoval = fake.calls.find(
    ([name, details]) =>
      name === "cookies.remove" && details.name === `${SESSION_COOKIE}.0`,
  );
  assert.deepEqual(targetRemoval, [
    "cookies.remove",
    {
      url: "https://chatgpt.com/",
      name: `${SESSION_COOKIE}.0`,
      storeId: "private-store",
    },
  ]);
  assert.equal(
    fake.calls.some(
      ([name, details]) =>
        name === "cookies.remove" &&
        details.name === "unrelated-cookie",
    ),
    false,
  );

  const cookieWrite = fake.calls.find(([name]) => name === "cookies.set");
  assert.deepEqual(cookieWrite, [
    "cookies.set",
    {
      url: "https://chatgpt.com/",
      name: SESSION_COOKIE,
      value: "abc",
      domain: "chatgpt.com",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      storeId: "private-store",
    },
  ]);

  const navigationCalls = fake.calls.filter(
    ([name]) => name === "tabs.update",
  );
  assert.deepEqual(navigationCalls, [
    [
      "tabs.update",
      50,
      { url: "https://chatgpt.com/api/auth/session" },
    ],
    ["tabs.update", 50, { url: "https://chatgpt.com/" }],
  ]);
});

test("rolls back cookies, state, and the new window when verification rejects", async () => {
  const fake = createFakeBrowser({ cookies: [] });

  await assert.rejects(
    openIsolatedSession("abc", {
      browser: fake.browser,
      waitForTab: async () => {},
      verifyTab: async () => false,
    }),
    (error) => error.code === "SESSION_REJECTED",
  );

  assert.equal(
    fake.calls.some(
      ([name, windowId]) => name === "windows.remove" && windowId === 40,
    ),
    true,
  );
  assert.equal(
    fake.calls.some(
      ([name, key]) =>
        name === "storage.session.remove" && key === "managedSession",
    ),
    true,
  );
  assert.equal(
    fake.calls.filter(([name]) => name === "cookies.getAll").length,
    2,
  );
  assert.equal(fake.sessionState.managedSession, undefined);
});

test("closes the created window when its InPrivate cookie store is unavailable", async () => {
  const fake = createFakeBrowser({ cookieStores: [] });

  await assert.rejects(
    openIsolatedSession("abc", { browser: fake.browser }),
    (error) => error.code === "COOKIE_STORE_NOT_FOUND",
  );
  assert.equal(
    fake.calls.some(
      ([name, windowId]) => name === "windows.remove" && windowId === 40,
    ),
    true,
  );
});

test("cleans only the managed window state on window close", async () => {
  const fake = createFakeBrowser({
    storedState: {
      managedSession: { windowId: 40, storeId: "private-store" },
    },
  });

  assert.equal(
    await cleanupManagedSession(41, { browser: fake.browser }),
    false,
  );
  assert.equal(fake.sessionState.managedSession.windowId, 40);

  assert.equal(
    await cleanupManagedSession(40, { browser: fake.browser }),
    true,
  );
  assert.equal(fake.sessionState.managedSession, undefined);
  assert.equal(
    fake.calls.some(
      ([name, details]) =>
        name === "cookies.getAll" &&
        details.storeId === "private-store",
    ),
    true,
  );
});

function addTabEvents(browser) {
  const listeners = new Set();
  browser.tabs.onUpdated = {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
  };
  return listeners;
}

test("ignores initial blank-page completion and waits for the verification URL", async () => {
  const fake = createFakeBrowser();
  const listeners = addTabEvents(fake.browser);
  let verified = false;
  fake.browser.tabs.update = async (tabId, { url }) => {
    if (url.endsWith("/api/auth/session")) {
      for (const listener of listeners) {
        listener(tabId, { status: "complete" }, { url: "about:blank" });
      }
      await Promise.resolve();
      assert.equal(verified, false);
      assert.equal(listeners.size, 1);
      for (const listener of listeners) {
        listener(tabId, { status: "complete" }, { url });
      }
    }
  };
  await openIsolatedSession("abc", {
    browser: fake.browser,
    verifyTab: async () => { verified = true; return true; },
  });
  assert.equal(verified, true);
  assert.equal(listeners.size, 0);
});

test("removes the pending verification listener when navigation fails", async () => {
  const fake = createFakeBrowser();
  const listeners = addTabEvents(fake.browser);
  fake.browser.tabs.update = async () => { throw new Error("tab closed"); };
  await assert.rejects(
    openIsolatedSession("abc", { browser: fake.browser }),
    { code: "SESSION_VERIFICATION_FAILED" },
  );
  assert.equal(listeners.size, 0);
  assert.equal(fake.sessionState.managedSession, undefined);
});
