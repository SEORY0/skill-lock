import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { Io } from "../src/commands/common.js";
import { HOOK_COMMAND, runHook } from "../src/commands/hook.js";
import { runInit } from "../src/commands/init.js";
import { runVerify } from "../src/commands/verify.js";
import { makeFixture } from "./fixtures.js";

function captureIo(): { io: Io; lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { io: { out: (l) => lines.push(l), err: (l) => errors.push(l) }, lines, errors };
}

function readSettings(dir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(dir, "settings.json"), "utf8")) as Record<string, unknown>;
}

test("hook install adds SessionStart entry and keeps lockfile clean", async () => {
  const fix = makeFixture();
  assert.equal(await runInit([], fix.env, captureIo().io), 0);

  const install = captureIo();
  assert.equal(await runHook(["install"], fix.env, install.io), 0);
  assert.ok(JSON.stringify(readSettings(fix.env.claudeConfigDir)).includes(HOOK_COMMAND));

  const verify = captureIo();
  assert.equal(await runVerify([], fix.env, verify.io), 0, verify.lines.join("\n"));
});

test("hook install is idempotent", async () => {
  const fix = makeFixture();
  assert.equal(await runHook(["install"], fix.env, captureIo().io), 0);
  const again = captureIo();
  assert.equal(await runHook(["install"], fix.env, again.io), 0);
  assert.match(again.lines[0] ?? "", /already installed/);
  const raw = JSON.stringify(readSettings(fix.env.claudeConfigDir));
  assert.equal(raw.split(HOOK_COMMAND).length - 1, 1);
});

test("hook uninstall removes the entry and re-baselines", async () => {
  const fix = makeFixture();
  assert.equal(await runInit([], fix.env, captureIo().io), 0);
  assert.equal(await runHook(["install"], fix.env, captureIo().io), 0);
  assert.equal(await runHook(["uninstall"], fix.env, captureIo().io), 0);
  assert.ok(!JSON.stringify(readSettings(fix.env.claudeConfigDir)).includes(HOOK_COMMAND));
  const verify = captureIo();
  assert.equal(await runVerify([], fix.env, verify.io), 0, verify.lines.join("\n"));
});

test("hook rejects unknown action", async () => {
  const fix = makeFixture();
  const bad = captureIo();
  assert.equal(await runHook(["frobnicate"], fix.env, bad.io), 2);
  assert.match(bad.errors[0] ?? "", /usage/);
});
