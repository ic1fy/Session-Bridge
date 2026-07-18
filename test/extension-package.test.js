import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const extensionUrl = new URL("../extension/", import.meta.url);

async function readExtensionFile(path) {
  return readFile(new URL(path, extensionUrl), "utf8");
}

test("declares the minimum Manifest V3 permissions and InPrivate mode", async () => {
  const manifest = JSON.parse(await readExtensionFile("manifest.json"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.incognito, "spanning");
  assert.deepEqual(
    [...manifest.permissions].sort(),
    ["cookies", "scripting", "storage", "tabs"],
  );
  assert.deepEqual(manifest.host_permissions, ["https://chatgpt.com/*"]);
  assert.deepEqual(manifest.background, {
    service_worker: "background.js",
    type: "module",
  });
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.deepEqual(manifest.action.default_icon, {
    16: "assets/icon-16.png",
    32: "assets/icon-32.png",
  });
  assert.deepEqual(manifest.icons, {
    16: "assets/icon-16.png",
    32: "assets/icon-32.png",
    48: "assets/icon-48.png",
    128: "assets/icon-128.png",
  });
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.externally_connectable, undefined);
  assert.doesNotMatch(manifest.description, /Edge|Chrome/);
});

test("packages a local-only popup with one primary action", async () => {
  const html = await readExtensionFile("popup.html");
  const compactHtml = html.replaceAll(/\s+/g, " ");

  assert.equal((html.match(/<textarea\b/g) ?? []).length, 1);
  assert.equal(
    (html.match(/<button[^>]+type="submit"/g) ?? []).length,
    1,
  );
  assert.match(
    html,
    /<script\s+type="module"\s+src="popup\.js"><\/script>/,
  );
  assert.doesNotMatch(html, /<script(?![^>]+\bsrc=)[^>]*>/);
  assert.doesNotMatch(
    html,
    /<(?:script|link|img)[^>]+(?:src|href)="https?:\/\//,
  );
  assert.match(
    compactHtml,
    /> https:\/\/chatgpt\.com <\/a>/,
  );
  assert.match(
    compactHtml,
    /> https:\/\/chatgpt\.com\/api\/auth\/session <\/a>/,
  );
  assert.match(html, /验证并打开无痕窗口/);
  assert.match(html, /开启无痕模式访问权限/);
  assert.doesNotMatch(html, /\bEdge\b/);
  assert.doesNotMatch(html, /class="privacy-note"/);
});

test("keeps the popup private and the background response safe", async () => {
  const [popupScript, backgroundScript] = await Promise.all([
    readExtensionFile("popup.js"),
    readExtensionFile("background.js"),
  ]);

  assert.doesNotMatch(popupScript, /\bfetch\s*\(/);
  assert.doesNotMatch(popupScript, /chrome\.storage/);
  assert.doesNotMatch(popupScript, /console\./);
  assert.doesNotMatch(backgroundScript, /console\./);
  assert.match(backgroundScript, /OPEN_SESSION/);
  assert.match(backgroundScript, /cleanupManagedSession/);
});

test("uses responsive Apple-style controls with dark and reduced-motion modes", async () => {
  const styles = await readExtensionFile("popup.css");

  assert.match(styles, /font-family:[\s\S]*-apple-system/);
  assert.match(styles, /width:\s*min\(360px,\s*100vw\)/);
  assert.match(styles, /height:\s*clamp\(96px,\s*18vh,\s*112px\)/);
  assert.match(styles, /\.hero\s*\{[\s\S]*display:\s*grid/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /@media\s*\(max-height:\s*520px\)/);
  assert.match(styles, /@media\s*\(max-width:\s*360px\)/);
  assert.match(styles, /@media\s*\(prefers-color-scheme:\s*dark\)/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
