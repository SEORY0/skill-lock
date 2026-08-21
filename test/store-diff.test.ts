import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { isProbablyBinary, unifiedDiff } from "../src/core/difftext.js";
import { ObjectStore } from "../src/core/store.js";
import { sha256 } from "../src/util/hash.js";

test("ObjectStore write→read round-trips and is idempotent", () => {
  const store = new ObjectStore(join(mkdtempSync(join(tmpdir(), "sl-store-")), "objects"));
  const content = Buffer.from("hello skill-lock\n");
  const sha = store.write(content);
  assert.equal(sha, sha256(content));
  assert.equal(store.write(content), sha);
  assert.ok(store.has(sha));
  assert.deepEqual(store.read(sha), content);
});

test("ObjectStore read of missing sha throws with sha in message", () => {
  const store = new ObjectStore(join(mkdtempSync(join(tmpdir(), "sl-store-")), "objects"));
  assert.throws(() => store.read("f".repeat(64)), /snapshot object not found: f{64}/);
});

test("unifiedDiff: identical inputs → empty string", () => {
  assert.equal(unifiedDiff("a\nb\n", "a\nb\n", "x", "y"), "");
});

test("unifiedDiff: single line replacement", () => {
  const diff = unifiedDiff("a\nb\nc\n", "a\nB\nc\n", "old", "new");
  assert.equal(diff, "--- old\n+++ new\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n");
});

test("unifiedDiff: pure addition into empty file", () => {
  const diff = unifiedDiff("", "x\n", "old", "new");
  assert.equal(diff, "--- old\n+++ new\n@@ -0,0 +1,1 @@\n+x\n");
});

test("unifiedDiff: deletion", () => {
  const diff = unifiedDiff("a\nb\n", "a\n", "old", "new");
  assert.equal(diff, "--- old\n+++ new\n@@ -1,2 +1,1 @@\n a\n-b\n");
});

test("unifiedDiff: context window limits hunk and far edits form two hunks", () => {
  const lines = Array.from({ length: 20 }, (_, i) => `l${i}`);
  const changed = [...lines];
  changed[1] = "L1";
  changed[18] = "L18";
  const diff = unifiedDiff(`${lines.join("\n")}\n`, `${changed.join("\n")}\n`, "a", "b");
  const hunkHeaders = diff.split("\n").filter((l) => l.startsWith("@@"));
  assert.equal(hunkHeaders.length, 2);
  assert.equal(hunkHeaders[0], "@@ -1,5 +1,5 @@");
});

test("unifiedDiff: missing trailing newline is a real difference", () => {
  const diff = unifiedDiff("x\n", "x", "old", "new");
  assert.ok(diff.includes("\\ No newline at end of file"));
  assert.ok(diff.includes("-x\n"));
  assert.ok(diff.includes("+x\n"));
});

test("isProbablyBinary detects NUL bytes", () => {
  assert.equal(isProbablyBinary(Buffer.from("plain text")), false);
  assert.equal(isProbablyBinary(Buffer.from([0x68, 0x00, 0x69])), true);
});
