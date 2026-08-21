import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { canonicalJson } from "../util/canonical.js";
import type { Env } from "./env.js";
import type { ArtifactRecord, LockEntry, Lockfile, Scope } from "./types.js";

export const LOCKFILE_VERSION = 1;
export const PROJECT_LOCKFILE_NAME = "skill-lock.json";

export function lockfilePath(scope: Scope, env: Env): string {
  return scope === "project"
    ? join(env.cwd, PROJECT_LOCKFILE_NAME)
    : join(env.stateDir, "user.lock.json");
}

export function readLockfile(scope: Scope, env: Env): Lockfile | null {
  let raw: string;
  try {
    raw = readFileSync(lockfilePath(scope, env), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const parsed = JSON.parse(raw) as Lockfile;
  if (parsed.lockfileVersion !== LOCKFILE_VERSION) {
    throw new Error(
      `unsupported lockfileVersion ${String(parsed.lockfileVersion)} (expected ${LOCKFILE_VERSION})`,
    );
  }
  return parsed;
}

export function writeLockfile(lock: Lockfile, scope: Scope, env: Env): void {
  const path = lockfilePath(scope, env);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, canonicalJson(lock));
}

export function buildLockfile(
  records: ArtifactRecord[],
  scope: Scope,
  harness: string,
  toolVersion: string,
): Lockfile {
  const artifacts: Record<string, LockEntry> = {};
  for (const record of records) {
    artifacts[record.id] = { type: record.type, sha256: record.sha256, size: record.size };
  }
  return {
    lockfileVersion: LOCKFILE_VERSION,
    generatedAt: new Date().toISOString(),
    tool: { name: "skill-lock", version: toolVersion },
    harness,
    scope,
    artifacts,
  };
}
