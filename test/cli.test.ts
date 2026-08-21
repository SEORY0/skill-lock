import assert from "node:assert/strict";
import { test } from "node:test";
import type { Io } from "../src/commands/common.js";

process.env.SKILL_LOCK_NO_AUTORUN = "1";
const { main, toolVersion } = await import("../src/cli.js");

function captureIo(): { io: Io; lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { io: { out: (l) => lines.push(l), err: (l) => errors.push(l) }, lines, errors };
}

test("--version prints package version", async () => {
  const { io, lines } = captureIo();
  assert.equal(await main(["--version"], io), 0);
  assert.equal(lines[0], `skill-lock ${toolVersion()}`);
});

test("--help exits 0, bare invocation exits 2, both print usage", async () => {
  const help = captureIo();
  assert.equal(await main(["--help"], help.io), 0);
  assert.match(help.lines.join("\n"), /Usage: skill-lock/);

  const bare = captureIo();
  assert.equal(await main([], bare.io), 2);
  assert.match(bare.lines.join("\n"), /Usage: skill-lock/);
});

test("unknown command exits 2", async () => {
  const { io, errors } = captureIo();
  assert.equal(await main(["frobnicate"], io), 2);
  assert.match(errors[0] ?? "", /unknown command: frobnicate/);
});

test("unknown flag is reported as error, not a crash", async () => {
  const { io, errors } = captureIo();
  assert.equal(await main(["verify", "--bogus"], io), 2);
  assert.match(errors[0] ?? "", /error:/);
});
