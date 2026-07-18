import { ServiceError } from "../errors/service-error.js";
import {
  buildSessionCookies,
  SESSION_COOKIE_PATTERN,
} from "../session/build-session-cookies.js";

const VERIFY_URL = "https://chatgpt.com/api/auth/session";
const HOME_URL = "https://chatgpt.com/";

function isChatGptUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "chatgpt.com" ||
        url.hostname.endsWith(".chatgpt.com"))
    );
  } catch {
    return false;
  }
}

function findBlankPage(context) {
  return context.pages().find((page) => page.url() === "about:blank");
}

async function closeOtherPages(context, targetPage) {
  const otherPages = context.pages().filter((page) => page !== targetPage);
  await Promise.allSettled(otherPages.map((page) => page.close()));
}

export class EdgeSessionManager {
  constructor({ chromium, profileDir, cleanupProfile = async () => {} }) {
    this.chromium = chromium;
    this.profileDir = profileDir;
    this.cleanupProfile = cleanupProfile;
    this.cleanupPromise = null;
    this.context = null;
  }

  cleanupProfileData() {
    this.cleanupPromise ??= Promise.resolve().then(() =>
      this.cleanupProfile(),
    );
    return this.cleanupPromise;
  }

  async ensureContext() {
    if (this.context) return this.context;

    if (this.cleanupPromise) {
      await this.cleanupPromise.catch(() => {});
      this.cleanupPromise = null;
    }

    try {
      const context = await this.chromium.launchPersistentContext(
        this.profileDir,
        {
          channel: "msedge",
          headless: false,
          viewport: null,
          ignoreDefaultArgs: ["--no-sandbox"],
        },
      );
      this.context = context;
      context.on("close", () => {
        if (this.context === context) this.context = null;
        const cleanup = this.cleanupProfileData();
        void cleanup.catch(() => {});
        return cleanup;
      });
      return context;
    } catch {
      await this.cleanupProfileData().catch(() => {});
      throw new ServiceError(
        "EDGE_LAUNCH_FAILED",
        "无法启动 Microsoft Edge，请确认 Edge 已安装且专用配置未被占用。",
        500,
      );
    }
  }

  async clearSessionCookies(context) {
    await context.clearCookies({
      domain: "chatgpt.com",
      name: SESSION_COOKIE_PATTERN,
    });
  }

  async verifySession(context) {
    let session;
    try {
      const response = await context.request.get(VERIFY_URL, {
        timeout: 15_000,
      });
      session = response.ok() ? await response.json() : null;
    } catch {
      await this.clearSessionCookies(context);
      throw new ServiceError(
        "SESSION_VERIFICATION_FAILED",
        "无法连接 ChatGPT 验证会话。",
        502,
      );
    }

    if (!session?.user || typeof session.user !== "object") {
      await this.clearSessionCookies(context);
      throw new ServiceError(
        "SESSION_REJECTED",
        "ChatGPT 未接受该会话，请重新复制未过期的完整 JSON。",
        401,
      );
    }
  }

  async openChatGpt(context) {
    let page;
    try {
      page = findBlankPage(context) ?? (await context.newPage());
      try {
        await page.goto(HOME_URL, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
      } catch (error) {
        if (!isChatGptUrl(page.url())) throw error;
      }
      await page.bringToFront();
      await closeOtherPages(context, page);
    } catch {
      await page?.close?.().catch(() => {});
      throw new ServiceError(
        "EDGE_NAVIGATION_FAILED",
        "会话已验证，但无法在 Edge 中打开 ChatGPT。",
        502,
      );
    }
  }

  async openSession(sessionToken) {
    const context = await this.ensureContext();
    await this.clearSessionCookies(context);
    await context.addCookies(buildSessionCookies(sessionToken));
    await this.verifySession(context);
    await this.openChatGpt(context);
    return { opened: true };
  }

  async close() {
    const context = this.context;
    this.context = null;
    if (context) {
      try {
        await this.clearSessionCookies(context);
      } catch {
        // The browser may already be closing; profile removal is the fallback.
      }
      await context.close();
    }
    await this.cleanupProfileData();
  }
}
