# skill-lock v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship skill-lock v0.1 — a zero-dependency TypeScript CLI that hash-pins Claude Code skills/agents/hooks/plugins/MCP config and detects drift, with full OSS infra (CI, release-please, npm provenance publish).

**Architecture:** Pure-function core (hash → collect → compare → report) around a JSON lockfile plus a gzip content-addressable snapshot store. Harness-specific artifact enumeration lives behind a `HarnessAdapter` interface; v0.1 ships only `claude-code`. Commands are functions `(argv, env, io) → exit code` so tests never spawn processes; `cli.ts` is a thin dispatcher.

**Tech Stack:** TypeScript (strict, ESM, NodeNext), Node >= 20 builtins only at runtime (`node:crypto`, `node:zlib`, `node:util` parseArgs, `node:test`). devDeps: `typescript`, `@types/node`, `@biomejs/biome`.

## Global Constraints

- Zero runtime dependencies; `package.json` `"dependencies"` must stay absent.
- Node floor: `"engines": { "node": ">=20" }`.
- All filesystem roots injectable via `Env` (`CLAUDE_CONFIG_DIR`, `SKILL_LOCK_STATE_DIR` env vars) — no hardcoded `~` outside `env.ts`.
- Windows-safe paths (`node:path`, no shell-outs) — CI matrix includes windows-latest.
- Lockfile ids use forward slashes on all platforms.
- Conventional commits; every commit message ends with the Co-Authored-By trailer.
- Tests run against compiled `dist/` via `node --test dist/test/`.

## Shared contracts (all tasks)

```ts
// src/core/types.ts
export type ArtifactType = "skill" | "agent" | "command" | "memory"
  | "plugin" | "plugin-manifest" | "hooks-config" | "mcp-config";
export type Scope = "user" | "project";
export interface ArtifactRecord {
  id: string;            // e.g. "skills/foo/SKILL.md" or "settings.json#hooks"
  type: ArtifactType;
  sha256: string;
  size: number;
  content: Buffer;       // exact bytes that were hashed
}
export interface LockEntry { type: ArtifactType; sha256: string; size: number; }
export interface Lockfile {
  lockfileVersion: 1;
  generatedAt: string;
  tool: { name: string; version: string };
  harness: string;
  scope: Scope;
  artifacts: Record<string, LockEntry>;
}
export type ChangeKind = "added" | "modified" | "removed";
export type Risk = "high" | "medium" | "low";
export interface DriftItem {
  id: string; type: ArtifactType; kind: ChangeKind; risk: Risk;
  oldSha?: string; newSha?: string;
}

// src/core/env.ts
export interface Env {
  home: string; cwd: string;
  claudeConfigDir: string;   // $CLAUDE_CONFIG_DIR || join(home, ".claude")
  stateDir: string;          // $SKILL_LOCK_STATE_DIR || join(home, ".skill-lock")
}
export function resolveEnv(base?: Partial<Env>): Env;

// src/adapters/adapter.ts
export interface HarnessAdapter {
  name: string;
  detect(env: Env): boolean;
  collect(scope: Scope, env: Env): ArtifactRecord[];
}

// command shape (src/commands/*.ts)
export interface Io { out(line: string): void; err(line: string): void; }
export function run(argv: string[], env: Env, io: Io): Promise<number>;
```

Lockfile locations: project scope → `join(env.cwd, "skill-lock.json")`; user scope →
`join(env.stateDir, "user.lock.json")`. Snapshots → `join(env.stateDir, "objects", sha256)`
(gzip). Risk table and artifact inventory: copy exactly from the spec
(`docs/superpowers/specs/2026-08-21-skill-lock-design.md`).

---

### Task 1: Scaffold + toolchain

**Files:** Create `package.json`, `tsconfig.json`, `biome.json`, `.gitignore`, `LICENSE` (MIT, © 2026 SEORY0), `src/cli.ts` (placeholder printing version), `test/smoke.test.ts`.

- [ ] package.json: name `skill-lock`, version `0.1.0`, type module, bin `{"skill-lock": "dist/src/cli.js"}`, scripts `build` (tsc), `test` (build + `node --test dist/test/`), `lint` (biome check), `typecheck` (tsc --noEmit); engines node >=20; files `["dist/src"]`; no `dependencies` key.
- [ ] `npm i -D typescript @types/node @biomejs/biome`
- [ ] tsconfig: NodeNext/ES2022, strict, outDir dist, rootDir ., include src+test.
- [ ] smoke test asserts cli module exports `main`; run `npm test` → PASS.
- [ ] Commit `chore: scaffold zero-dep typescript package`.

### Task 2: util — canonical JSON, hash, walk, ANSI

**Files:** Create `src/util/canonical.ts`, `src/util/hash.ts`, `src/util/fswalk.ts`, `src/util/term.ts`; Test `test/util.test.ts`.

**Interfaces — Produces:**
```ts
canonicalJson(value: unknown): string       // sorted keys, 2-space indent, trailing \n
sha256(buf: Buffer | string): string        // hex
walkFiles(root: string): string[]           // sorted relative POSIX paths, skips .DS_Store/Thumbs.db; [] if root missing
color(kind: "red"|"yellow"|"green"|"dim"|"bold", s: string, enabled: boolean): string
```

- [ ] TDD: key sorting is recursive; walk returns sorted POSIX-relative paths on Windows too; hash of empty buffer = known vector `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- [ ] Commit `feat: canonical json, sha256, fs walk, ansi helpers`.

### Task 3: env + lockfile IO

**Files:** Create `src/core/types.ts`, `src/core/env.ts`, `src/core/lockfile.ts`; Test `test/lockfile.test.ts`.

**Interfaces — Produces:**
```ts
resolveEnv(base?: Partial<Env>): Env
lockfilePath(scope: Scope, env: Env): string
readLockfile(scope: Scope, env: Env): Lockfile | null       // null if absent; throws on bad version
writeLockfile(lock: Lockfile, scope: Scope, env: Env): void  // mkdir -p, canonicalJson
buildLockfile(records: ArtifactRecord[], scope: Scope, version: string): Lockfile
```

- [ ] TDD with tmpdir env; round-trip write→read equality; unknown `lockfileVersion` throws.
- [ ] Commit `feat: env resolution and lockfile io`.

### Task 4: snapshot object store

**Files:** Create `src/core/store.ts`; Test `test/store.test.ts`.

**Interfaces — Produces:**
```ts
class ObjectStore {
  constructor(dir: string);
  has(sha256: string): boolean;
  write(content: Buffer): string;   // returns sha256; gzip to dir/<sha>; idempotent
  read(sha256: string): Buffer;     // gunzip; throws if missing
}
```

- [ ] TDD: write→read round-trip; idempotent write; read of missing sha throws with sha in message.
- [ ] Commit `feat: gzip content-addressable snapshot store`.

### Task 5: unified line diff (zero-dep)

**Files:** Create `src/core/difftext.ts`; Test `test/difftext.test.ts`.

**Interfaces — Produces:**
```ts
unifiedDiff(a: string, b: string, labelA: string, labelB: string, context?: number): string
// "" when equal; LCS-based line diff; @@ hunk headers; handles missing trailing newline
isProbablyBinary(buf: Buffer): boolean   // NUL byte in first 8192 bytes
```

- [ ] TDD: insert/delete/replace cases produce expected hunks; identical → ""; hunk coalescing with context=3.
- [ ] Commit `feat: zero-dep unified diff`.

### Task 6: claude-code adapter

**Files:** Create `src/adapters/adapter.ts`, `src/adapters/claude-code.ts`; Test `test/claude-code.test.ts`, `test/fixtures.ts`.

**Interfaces — Consumes:** walkFiles, sha256, canonicalJson, Env. **Produces:** `claudeCodeAdapter: HarnessAdapter`; `makeFixture(t)` test helper creating a fake config tree + project dir in tmpdir and returning an `Env`.

Collection rules (user scope, root = `env.claudeConfigDir`): dirs `skills/`, `agents/`, `commands/` → per-file records typed by dir; `CLAUDE.md` → memory; `plugins/installed_plugins.json` → plugin-manifest; `plugins/cache/**` → plugin; `settings.json` keys `hooks`/`mcpServers` → projection records id `settings.json#hooks` / `settings.json#mcpServers`, content = canonicalJson of the key value (record absent when key absent). Project scope (root = `env.cwd`): `.claude/{skills,agents,commands}` per-file, `CLAUDE.md` memory, `.mcp.json` mcp-config (whole file), projections from `.claude/settings.json` and `.claude/settings.local.json` (ids `.claude/settings.json#hooks` etc.).

- [ ] TDD against fixture: expected id set, types, stable ordering, projection noise-immunity (changing `model` key doesn't change records).
- [ ] Commit `feat: claude-code harness adapter`.

### Task 7: compare + risk

**Files:** Create `src/core/compare.ts`, `src/core/risk.ts`; Test `test/compare.test.ts`.

**Interfaces — Produces:**
```ts
compare(lock: Lockfile, current: ArtifactRecord[]): DriftItem[]  // sorted by risk desc, then id
assessRisk(type: ArtifactType, kind: ChangeKind): Risk           // table from spec
```

- [ ] TDD: added/modified/removed detection; risk table spot-checks (hooks-config modified → high; plugin-manifest → medium; removed skill → medium).
- [ ] Commit `feat: drift comparison and risk assessment`.

### Task 8: commands — init, verify, status

**Files:** Create `src/commands/init.ts`, `src/commands/verify.ts`, `src/commands/status.ts`, `src/commands/common.ts` (scope parsing, adapter selection, Io); Test `test/commands.test.ts`.

Behavior: init refuses existing lockfile without `--force` (exit 2, message says use --force); init writes lockfile + snapshots all records. verify exits 0 clean / 1 drift / 2 error; prints per-item `risk kind type id`; `--json` prints DriftItem[]; `--hook` always exits 0 and prints compact warning block only when drift exists. status prints artifact count, lockfile age, drift summary.

- [ ] TDD full cycle on fixture: init → verify clean → mutate skill file + add hook key → verify exit 1 with high-risk items → `--hook` exit 0.
- [ ] Commit `feat: init, verify, status commands`.

### Task 9: commands — diff, approve

**Files:** Create `src/commands/diff.ts`, `src/commands/approve.ts`; Test extends `test/commands.test.ts`.

Behavior: diff with no args shows all drifted; with path args filters by id prefix; uses ObjectStore snapshot vs current content; binary → hash/size notice; added → diff vs empty; removed → diff to empty. approve requires path args or `--all` (else exit 2); updates only approved entries (add/update/remove), snapshots new content, rewrites lockfile.

- [ ] TDD: diff shows expected hunk after skill edit; approve one path → verify still reports the other drift; approve --all → verify exit 0.
- [ ] Commit `feat: diff and approve commands`.

### Task 10: hook install/uninstall

**Files:** Create `src/commands/hook.ts`; Test `test/hook.test.ts`.

Behavior: `hook install` inserts `{type:"command", command:"npx -y skill-lock verify --hook"}` under `hooks.SessionStart` in user `settings.json` (creating structures as needed, not duplicating an existing entry), then re-approves the `settings.json#hooks` projection in the user lockfile if one exists. `hook uninstall` removes the entry. Both print what changed.

- [ ] TDD: install on empty settings; idempotent double-install; lockfile stays clean after install; uninstall restores.
- [ ] Commit `feat: session-start hook install`.

### Task 11: CLI wiring + docs

**Files:** Modify `src/cli.ts` (parseArgs dispatch, `--version`, `--help`, unknown command → exit 2, NO_COLOR support); Create `README.md`, `SECURITY.md`, `CONTRIBUTING.md`; Test `test/cli.test.ts`.

README sections: hero + badges, why (ToxicSkills/ClawHub links), quickstart, commands, how it works (TOFU/lockfile/CAS), threat model table, roadmap, contributing pointer. CONTRIBUTING centers the adapter guide (interface + fixture testing). SECURITY.md: private disclosure via GitHub security advisories, 90-day window.

- [ ] cli test: `--version` matches package.json; unknown command exit 2.
- [ ] Commit `feat: cli entry` / `docs: readme, security policy, contributing`.

### Task 12: CI + release automation

**Files:** Create `.github/workflows/ci.yml`, `.github/workflows/release-please.yml`, `.github/dependabot.yml`, `.github/ISSUE_TEMPLATE/{bug_report.yml,feature_request.yml,adapter_request.yml,config.yml}`, `.github/PULL_REQUEST_TEMPLATE.md`.

ci.yml: on push to main + PRs; job lint (biome ci + tsc --noEmit, ubuntu, node 22); job test matrix {ubuntu, macos, windows} × node {20, 22, 24} running `npm ci && npm test`. release-please.yml: googleapis/release-please-action@v4 release-type node on main; publish job gated on release created AND NPM_TOKEN present (env presence check step), runs `npm publish --provenance --access public` with id-token: write. dependabot: weekly, ecosystems github-actions + npm.

- [ ] Commit `ci: test matrix, release-please, provenance publish`.

### Task 13: Publish repo + verify CI

- [ ] `gh repo create SEORY0/skill-lock --public --source . --push` (with GIT_CONFIG_NOSYSTEM=1).
- [ ] `gh repo edit` description + topics (claude-code, agent-skills, security, supply-chain, lockfile, mcp, integrity).
- [ ] Watch first CI run (`gh run watch`); fix failures until green; confirm release-please opens PR.
- [ ] Real-environment smoke test: run built CLI against the actual `~/.claude` (init to a temp state dir) and capture output for README.

## Self-review notes

Spec coverage: threat model → README (T11); artifact inventory → T6; lockfile/CAS → T3/T4; CLI six commands → T8/T9/T10; risk table → T7; zero-dep/Node 20/Windows → global constraints + T12 matrix; release/provenance → T12; adapter contribution path → T11 CONTRIBUTING + adapter_request template. Type names consistent with Shared contracts block. No placeholders remain.
