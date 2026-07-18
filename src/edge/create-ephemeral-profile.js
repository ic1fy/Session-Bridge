import { rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createEphemeralProfile({ baseDir = tmpdir() } = {}) {
  const profileDir = await mkdtemp(
    join(baseDir, "chatgpt-session-web-service-"),
  );

  return {
    profileDir,
    cleanup: () =>
      rm(profileDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      }),
    cleanupSync: () =>
      rmSync(profileDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      }),
  };
}
