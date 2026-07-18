import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createEphemeralProfile } from "./edge/create-ephemeral-profile.js";
import { EdgeSessionManager } from "./edge/edge-session-manager.js";
import { startLocalServer } from "./http/start-local-server.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const webDir = join(currentDir, "web");
const requestToken = randomBytes(32).toString("base64url");
const [indexHtml, appJs, stylesCss, faviconSvg] = await Promise.all([
  readFile(join(webDir, "index.html"), "utf8"),
  readFile(join(webDir, "app.js"), "utf8"),
  readFile(join(webDir, "styles.css"), "utf8"),
  readFile(join(webDir, "favicon.svg"), "utf8"),
]);
const ephemeralProfile = await createEphemeralProfile();
process.once("exit", () => {
  try {
    ephemeralProfile.cleanupSync();
  } catch {
    // Best-effort fallback after the asynchronous browser cleanup.
  }
});

const edgeManager = new EdgeSessionManager({
  chromium,
  profileDir: ephemeralProfile.profileDir,
  cleanupProfile: ephemeralProfile.cleanup,
});
const local = await startLocalServer({
  edgeManager,
  requestToken,
  indexHtml,
  assets: new Map([
    ["/app.js", { type: "text/javascript; charset=utf-8", body: appJs }],
    ["/styles.css", { type: "text/css; charset=utf-8", body: stylesCss }],
    [
      "/favicon.svg",
      { type: "image/svg+xml; charset=utf-8", body: faviconSvg },
    ],
  ]),
});

console.log(`本地服务已启动：${local.url}`);
const opener = spawn("open", [local.url], {
  detached: true,
  stdio: "ignore",
});
opener.on("error", () => {});
opener.unref();

let shutdownPromise = null;
function shutdown() {
  shutdownPromise ??= (async () => {
    try {
      await local.close();
    } finally {
      await edgeManager.close();
    }
  })();
  return shutdownPromise;
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => {
    shutdown().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}
