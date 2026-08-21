import assert from "node:assert/strict";
import { test } from "node:test";

process.env.SKILL_LOCK_NO_AUTORUN = "1";
const { main, toolVersion } = await import("../src/cli.js");

test("cli exports main()", () => {
  assert.equal(typeof main, "function");
});

test("toolVersion matches semver", () => {
  assert.match(toolVersion(), /^\d+\.\d+\.\d+/);
});
