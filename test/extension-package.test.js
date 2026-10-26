import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const extensionUrl = new URL("../extension/", import.meta.url);

test("manifest limits site access and references existing extension entry points", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", extensionUrl), "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.incognito, "spanning");
  assert.deepEqual([...manifest.permissions].sort(), ["cookies", "scripting", "storage", "tabs"]);
  assert.deepEqual(manifest.host_permissions, ["https://chatgpt.com/*"]);
  assert.equal(manifest.background.type, "module");
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.externally_connectable, undefined);

  const entryPoints = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];
  for (const path of entryPoints) {
    assert.equal(typeof path, "string");
    await access(new URL(path, extensionUrl));
  }
});
