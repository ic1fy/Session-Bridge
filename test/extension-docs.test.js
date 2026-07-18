import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, rootUrl), "utf8");
}

test("explains local Edge and Chrome installation permissions", async () => {
  const extensionReadme = await readProjectFile("extension/README.md");

  assert.match(extensionReadme, /edge:\/\/extensions/);
  assert.match(extensionReadme, /chrome:\/\/extensions/);
  assert.match(extensionReadme, /加载解压缩的扩展/);
  assert.match(extensionReadme, /允许 InPrivate/);
  assert.match(extensionReadme, /在无痕模式下启用/);
  assert.match(
    extensionReadme,
    /右上角.*Session Bridge.*图标/,
  );
  assert.match(extensionReadme, /本人或已获授权/);
  assert.match(extensionReadme, /不需要.*服务器/s);
});

test("packages only the extension directory into the expected ZIP", async () => {
  const packageScript = await readProjectFile(
    "scripts/package-extension.sh",
  );

  assert.match(packageScript, /session-bridge-chromium-extension\.zip/);
  assert.match(packageScript, /extension/);
  assert.match(packageScript, /zip\s+-X\s+-r/);
  assert.doesNotMatch(packageScript, /\brm\s+-rf\b/);
  assert.doesNotMatch(packageScript, /\beval\b/);
});
