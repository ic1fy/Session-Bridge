import assert from "node:assert/strict";
import test from "node:test";
import { EdgeSessionManager } from "../src/edge/edge-session-manager.js";

function createFakeBrowser({
  verification = { user: { id: "u1" } },
  initialUrls = ["about:blank"],
} = {}) {
  const calls = [];
  const pages = [];
  const eventHandlers = new Map();

  function createPage(initialUrl, label) {
    let currentUrl = initialUrl;
    let closed = false;
    const page = {
      url: () => currentUrl,
      isClosed: () => closed,
      goto: async (url) => {
        calls.push(["goto", label, url]);
        currentUrl = url;
      },
      bringToFront: async () => calls.push(["bringToFront", label]),
      close: async () => {
        closed = true;
        calls.push(["closePage", label]);
      },
    };
    pages.push(page);
    return page;
  }

  initialUrls.forEach((url, index) => createPage(url, `initial-${index}`));

  const context = {
    on(event, handler) {
      eventHandlers.set(event, handler);
    },
    pages: () => pages.filter((page) => !page.isClosed()),
    newPage: async () => {
      calls.push(["newPage"]);
      return createPage("about:blank", `new-${pages.length}`);
    },
    clearCookies: async (filter) => calls.push(["clearCookies", filter]),
    addCookies: async (cookies) => calls.push(["addCookies", cookies]),
    request: {
      get: async (url) => ({
        ok: () => true,
        json: async () => verification,
        url: () => url,
      }),
    },
    close: async () => {
      calls.push(["close"]);
      await eventHandlers.get("close")?.();
    },
  };
  const chromium = {
    launchPersistentContext: async (profileDir, options) => {
      calls.push(["launch", profileDir, options]);
      return context;
    },
  };
  return { chromium, context, calls, pages };
}

test("reuses the initial blank tab and launches Edge without sandbox warning", async () => {
  const fake = createFakeBrowser();
  const manager = new EdgeSessionManager({
    chromium: fake.chromium,
    profileDir: "/tmp/dedicated-profile",
  });

  assert.deepEqual(
    await manager.openSession("token", {
      expiresAt: Date.parse("2030-01-01T00:00:00.000Z"),
    }),
    { opened: true },
  );
  assert.equal(fake.calls[0][0], "launch");
  assert.equal(fake.calls[0][2].channel, "msedge");
  assert.deepEqual(fake.calls[0][2].ignoreDefaultArgs, ["--no-sandbox"]);
  assert.equal(fake.calls[1][0], "clearCookies");
  assert.equal(fake.calls[2][0], "addCookies");
  assert.equal(Object.hasOwn(fake.calls[2][1][0], "expires"), false);
  assert.deepEqual(fake.calls.slice(-2), [
    ["goto", "initial-0", "https://chatgpt.com/"],
    ["bringToFront", "initial-0"],
  ]);
  assert.equal(fake.calls.some(([name]) => name === "newPage"), false);
  assert.equal(fake.context.pages().length, 1);
});

test("keeps exactly one managed tab on repeated imports", async () => {
  const fake = createFakeBrowser({ initialUrls: ["https://chatgpt.com/"] });
  const manager = new EdgeSessionManager({
    chromium: fake.chromium,
    profileDir: "/tmp/dedicated-profile",
  });

  assert.deepEqual(await manager.openSession("token"), { opened: true });
  assert.equal(fake.calls.some(([name]) => name === "newPage"), true);
  assert.deepEqual(fake.calls.at(-1), ["closePage", "initial-0"]);
  assert.equal(fake.context.pages().length, 1);
  assert.equal(fake.context.pages()[0].url(), "https://chatgpt.com/");
});

test("removes rejected cookies and returns a safe error", async () => {
  const fake = createFakeBrowser({
    verification: { WARNING_BANNER: "sensitive" },
  });
  const manager = new EdgeSessionManager({
    chromium: fake.chromium,
    profileDir: "/tmp/dedicated-profile",
  });

  await assert.rejects(
    manager.openSession("token"),
    (error) =>
      error.code === "SESSION_REJECTED" &&
      !error.safeMessage.includes("sensitive"),
  );
  assert.equal(
    fake.calls.filter(([name]) => name === "clearCookies").length,
    2,
  );
});

test("returns a safe error when the fresh ChatGPT tab cannot navigate", async () => {
  const fake = createFakeBrowser({ initialUrls: ["https://example.com/"] });
  fake.context.newPage = async () => ({
    goto: async () => {
      throw new Error("secret browser details");
    },
    url: () => "about:blank",
  });
  const manager = new EdgeSessionManager({
    chromium: fake.chromium,
    profileDir: "/tmp/dedicated-profile",
  });

  await assert.rejects(
    manager.openSession("token"),
    (error) =>
      error.code === "EDGE_NAVIGATION_FAILED" &&
      !error.safeMessage.includes("secret browser details"),
  );
});

test("accepts an interrupted navigation after the tab reached ChatGPT", async () => {
  const fake = createFakeBrowser({ initialUrls: ["https://example.com/"] });
  fake.context.newPage = async () => ({
    goto: async () => {
      throw new Error("navigation interrupted by the app");
    },
    url: () => "https://chatgpt.com/",
    bringToFront: async () => fake.calls.push(["bringToFront"]),
  });
  const manager = new EdgeSessionManager({
    chromium: fake.chromium,
    profileDir: "/tmp/dedicated-profile",
  });

  assert.deepEqual(await manager.openSession("token"), { opened: true });
  assert.equal(
    fake.calls.some(([name]) => name === "bringToFront"),
    true,
  );
  assert.deepEqual(fake.calls.at(-1), ["closePage", "initial-0"]);
});

test("clears the session and temporary profile when the manager closes", async () => {
  const fake = createFakeBrowser();
  const manager = new EdgeSessionManager({
    chromium: fake.chromium,
    profileDir: "/tmp/dedicated-profile",
    cleanupProfile: async () => fake.calls.push(["cleanupProfile"]),
  });

  await manager.openSession("token");
  await manager.close();

  assert.equal(
    fake.calls.filter(([name]) => name === "clearCookies").length,
    2,
  );
  assert.equal(
    fake.calls.filter(([name]) => name === "cleanupProfile").length,
    1,
  );
  assert.deepEqual(
    fake.calls.slice(-3).map(([name]) => name),
    ["clearCookies", "close", "cleanupProfile"],
  );
});

test("removes the temporary profile when the user closes Edge", async () => {
  const fake = createFakeBrowser();
  const manager = new EdgeSessionManager({
    chromium: fake.chromium,
    profileDir: "/tmp/dedicated-profile",
    cleanupProfile: async () => fake.calls.push(["cleanupProfile"]),
  });

  await manager.openSession("token");
  await fake.context.close();

  assert.equal(manager.context, null);
  assert.equal(
    fake.calls.filter(([name]) => name === "cleanupProfile").length,
    1,
  );
});
