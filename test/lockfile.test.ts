import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { resolveEnv } from "../src/core/env.js";
import { buildLockfile, lockfilePath, readLockfile, writeLockfile } from "../src/core/lockfile.js";
import type { ArtifactRecord } from "../src/core/types.js";

function tmpEnv() {
  const base = mkdtempSync(join(tmpdir(), "sl-lock-"));
  return resolveEnv({
    home: base,
    cwd: join(base, "proj"),
    claudeConfigDir: join(base, ".claude"),
    stateDir: join(base, ".skill-lock"),
  });
}

function record(id: string): ArtifactRecord {
  const content = Buffer.from(`content of ${id}`);
  return { id, type: "skill", sha256: "ab".repeat(32), size: content.length, content };
}

test("resolveEnv prefers explicit overrides", () => {
  const env = resolveEnv({ home: "/h", cwd: "/c", claudeConfigDir: "/cc", stateDir: "/s" });
  assert.deepEqual(env, { home: "/h", cwd: "/c", claudeConfigDir: "/cc", stateDir: "/s" });
});

test("lockfilePath: project → cwd/skill-lock.json, user → stateDir/user.lock.json", () => {
  const env = tmpEnv();
  assert.equal(lockfilePath("project", env), join(env.cwd, "skill-lock.json"));
  assert.equal(lockfilePath("user", env), join(env.stateDir, "user.lock.json"));
});

test("write→read round-trips for both scopes", () => {
  const env = tmpEnv();
  const lock = buildLockfile([record("skills/a/SKILL.md")], "user", "claude-code", "0.1.0");
  writeLockfile(lock, "user", env);
  assert.deepEqual(readLockfile("user", env), lock);
  assert.equal(readLockfile("project", env), null);
});

test("readLockfile returns null when absent, throws on bad version", () => {
  const env = tmpEnv();
  assert.equal(readLockfile("user", env), null);
  writeLockfile(buildLockfile([], "user", "claude-code", "0.1.0"), "user", env);
  const path = lockfilePath("user", env);
  writeFileSync(path, JSON.stringify({ lockfileVersion: 99, artifacts: {} }));
  assert.throws(() => readLockfile("user", env), /unsupported lockfileVersion 99/);
});

test("buildLockfile indexes records by id", () => {
  const lock = buildLockfile(
    [record("skills/a/SKILL.md"), record("agents/b.md")],
    "project",
    "claude-code",
    "0.1.0",
  );
  assert.deepEqual(Object.keys(lock.artifacts).sort(), ["agents/b.md", "skills/a/SKILL.md"]);
  assert.equal(lock.artifacts["agents/b.md"]?.type, "skill");
});
