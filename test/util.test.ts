import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { canonicalJson } from "../src/util/canonical.js";
import { walkFiles } from "../src/util/fswalk.js";
import { sha256 } from "../src/util/hash.js";
import { color } from "../src/util/term.js";

test("canonicalJson sorts keys recursively and ends with newline", () => {
  const out = canonicalJson({ b: 1, a: { z: [3, { y: 1, x: 2 }], k: null } });
  assert.equal(
    out,
    `${JSON.stringify({ a: { k: null, z: [3, { x: 2, y: 1 }] }, b: 1 }, null, 2)}\n`,
  );
});

test("canonicalJson is stable across key insertion order", () => {
  assert.equal(canonicalJson({ a: 1, b: 2 }), canonicalJson({ b: 2, a: 1 }));
});

test("sha256 known vector (empty input)", () => {
  assert.equal(
    sha256(Buffer.alloc(0)),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

test("walkFiles returns sorted posix-relative paths, skipping junk", () => {
  const root = mkdtempSync(join(tmpdir(), "sl-walk-"));
  mkdirSync(join(root, "b", "nested"), { recursive: true });
  writeFileSync(join(root, "b", "nested", "two.txt"), "2");
  writeFileSync(join(root, "a.txt"), "1");
  writeFileSync(join(root, ".DS_Store"), "junk");
  assert.deepEqual(walkFiles(root), ["a.txt", "b/nested/two.txt"]);
});

test("walkFiles on missing root returns empty", () => {
  assert.deepEqual(walkFiles(join(tmpdir(), "sl-definitely-missing")), []);
});

test("walkFiles does not follow symlinked directories", (t) => {
  const root = mkdtempSync(join(tmpdir(), "sl-walk-sym-"));
  mkdirSync(join(root, "real"));
  writeFileSync(join(root, "real", "f.txt"), "x");
  try {
    symlinkSync(join(root, "real"), join(root, "link"), "dir");
  } catch {
    t.skip("symlinks unavailable");
    return;
  }
  assert.deepEqual(walkFiles(root), ["real/f.txt"]);
});

test("color wraps only when enabled", () => {
  assert.equal(color("red", "x", false), "x");
  assert.equal(color("red", "x", true), "[31mx[0m");
});
