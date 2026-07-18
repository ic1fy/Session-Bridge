import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { createEphemeralProfile } from "../src/edge/create-ephemeral-profile.js";

test("creates an app-scoped temporary profile and removes it idempotently", async () => {
  const testRoot = await mkdtemp(join(tmpdir(), "session-bridge-test-"));
  try {
    const profile = await createEphemeralProfile({ baseDir: testRoot });
    assert.match(
      basename(profile.profileDir),
      /^chatgpt-session-web-service-/,
    );

    await writeFile(join(profile.profileDir, "marker"), "temporary");
    await profile.cleanup();
    await assert.rejects(access(profile.profileDir));
    await profile.cleanup();

    const syncProfile = await createEphemeralProfile({ baseDir: testRoot });
    await writeFile(join(syncProfile.profileDir, "marker"), "temporary");
    syncProfile.cleanupSync();
    await assert.rejects(access(syncProfile.profileDir));
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});
