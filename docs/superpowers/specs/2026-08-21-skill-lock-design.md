# skill-lock — Design Spec

Date: 2026-08-21
Status: Approved (design review 2026-08-21)

## One-liner

`package-lock.json` for AI agent skills: hash-pin every skill, agent, hook, plugin, and
MCP config your coding agent loads; detect tampering and drift across sessions.

## Motivation

Agent skill marketplaces are repeating the early npm era. Snyk's ToxicSkills research
found security flaws in 36% of published agent skills and 1,467 vulnerable skills;
coordinated malware campaigns via ClawHub shipped 30+ malicious skills in Feb 2026.
Install-time scanners (NVIDIA SkillSpector, Cisco skill-scanner, Snyk agent-scan) are
vendor-dominated, but nothing pins what you *already reviewed* and detects when it
changes afterwards. Post-install modification, silent marketplace updates, and
unauthorized artifact injection are unaddressed. skill-lock fills that gap.

## Threat model

In scope:

1. **Post-install modification** — a skill you reviewed is changed later
   (persistence attacks).
2. **Silent marketplace updates** — a plugin update changes behavior without review
   (dependency hijack).
3. **Unauthorized artifact injection** — a compromised session writes a new
   hook/skill/agent.

Out of scope (deliberately):

- Semantic maliciousness detection (scanners' job).
- Runtime enforcement/blocking (firewalls' job).

Trust model: **TOFU** (trust on first use). `skill-lock init` snapshots current state as
the trusted baseline. Every subsequent change must be reviewed via `diff` and accepted
via `approve`.

## Supported harnesses

v0.1 ships one adapter: **claude-code**. The adapter interface is public and documented
so contributors can add OpenClaw/Codex/opencode adapters (roadmap v0.2+).

```ts
interface HarnessAdapter {
  name: string;                                   // "claude-code"
  detect(env: Env): boolean;                      // is this harness present?
  collect(scope: "user" | "project", env: Env): ArtifactRecord[];
}
```

### claude-code adapter — locked artifacts

User scope (root: `$CLAUDE_CONFIG_DIR` or `~/.claude`):

| Artifact | Type | Notes |
| --- | --- | --- |
| `skills/**` | `skill` | per-file entries |
| `agents/**` | `agent` | |
| `commands/**` | `command` | |
| `CLAUDE.md` | `memory` | |
| `plugins/installed_plugins.json` | `plugin-manifest` | |
| `plugins/cache/**` | `plugin` | installed plugin bodies |
| `settings.json → hooks` | `hooks-config` | canonical-JSON projection |
| `settings.json → mcpServers` | `mcp-config` | canonical-JSON projection |

Project scope (root: cwd):

| Artifact | Type |
| --- | --- |
| `.claude/skills/**`, `.claude/agents/**`, `.claude/commands/**` | as above |
| `CLAUDE.md` | `memory` |
| `.mcp.json` | `mcp-config` |
| `.claude/settings.json → hooks/mcpServers`, `.claude/settings.local.json → hooks/mcpServers` | projections |

Projections exist so unrelated settings churn (theme, model) doesn't create noise:
only the security-relevant keys are extracted, canonicalized (sorted keys, 2-space
indent), and hashed as virtual artifacts (id: `settings.json#hooks` etc.).

## Data design

### Lockfile

- Project scope: `./skill-lock.json` — committable, so a team shares one baseline.
- User scope: `~/.skill-lock/user.lock.json`.

State lives **outside** `~/.claude` to avoid the tool watching itself.

```jsonc
{
  "lockfileVersion": 1,
  "generatedAt": "2026-08-21T00:00:00Z",
  "tool": { "name": "skill-lock", "version": "0.1.0" },
  "harness": "claude-code",
  "scope": "user",
  "artifacts": {
    "skills/foo/SKILL.md": { "type": "skill", "sha256": "…", "size": 1234 }
  }
}
```

### Snapshot store (CAS)

`~/.skill-lock/objects/<sha256>` — gzip-compressed originals of every locked artifact.
The lockfile alone can only say *that* something changed; the content-addressable store
lets `skill-lock diff` show a unified diff of *what* changed. This is the killer
feature. Objects are written on `init`/`approve`; unreferenced objects may be GC'd
later (non-goal for v0.1).

## CLI (v0.1)

```
skill-lock init [--scope user|project|all] [--force]
skill-lock verify [--scope …] [--hook] [--json]
skill-lock diff [path…] [--scope …]
skill-lock approve [path…|--all] [--scope …]
skill-lock status [--scope …]
skill-lock hook install|uninstall
```

- `init` — refuses to overwrite an existing lockfile without `--force`.
- `verify` — exit 0 clean, 1 drift, 2 error. Reports added/modified/removed with risk
  annotation. `--hook` mode always exits 0 (never break a session) and prints a
  compact warning designed to be injected into session context.
- `diff` — unified diff (own zero-dep line-diff impl) between snapshot and current.
  Binary artifacts fall back to hash/size change notice.
- `approve` — accepts current state for given paths (or all drift), updates lockfile +
  snapshots.
- `hook install` — registers `skill-lock verify --hook` as a Claude Code SessionStart
  hook in user `settings.json`, then auto-approves the settings projection change it
  just caused. This is the growth loop: install once, every session is guarded.

### Risk annotation rules

| Change | Risk |
| --- | --- |
| hooks/mcp projection added or modified | high |
| new skill/agent/command appeared | high |
| existing skill/agent/command modified | high |
| plugin cache content modified | high |
| plugin manifest changed | medium |
| CLAUDE.md modified | medium |
| artifact removed | medium |

## Implementation constraints

- **Zero runtime dependencies.** Node builtins only: `node:crypto` (sha256),
  `node:util` `parseArgs` (CLI), `node:zlib` (snapshots), ANSI colors hand-rolled.
- devDependencies: `typescript`, `@types/node`, `@biomejs/biome` only.
- Node >= 20, ESM, `strict` TypeScript.
- Tests: `node:test` against compiled output; fixtures build a fake `~/.claude` tree in
  a tmpdir; `CLAUDE_CONFIG_DIR` and `SKILL_LOCK_STATE_DIR` env overrides make every
  path injectable.
- Windows is a first-class target (CI matrix enforces).

## Repository & operations

- GitHub: `SEORY0/skill-lock`, public, MIT.
- CI (`ci.yml`): biome lint + `tsc --noEmit` + `node --test`, matrix
  {ubuntu, macos, windows} × Node {20, 22, 24}.
- Releases: conventional commits → release-please PR → tag → GitHub Release →
  `npm publish --provenance --access public` (a supply-chain tool proving its own
  provenance). Publish job skips gracefully until `NPM_TOKEN` secret exists.
- Governance: README (threat model, quickstart), SECURITY.md, CONTRIBUTING.md
  (adapter guide), issue templates (bug / feature / **adapter request**), dependabot.

## Testing strategy

Full-cycle fixture tests: init → mutate fixture (modify skill, add hook, bump plugin)
→ verify detects with correct risk → diff shows expected hunks → approve → verify
clean. Unit tests for hash, canonical JSON, line diff, lockfile IO, store, compare,
risk rules, adapter collection.

## Roadmap (public, in README)

- v0.1: claude-code adapter, init/verify/diff/approve/status/hook.
- v0.2: OpenClaw adapter, `--json` everywhere, watch mode.
- v0.3: Codex/opencode adapters, signed lockfiles, snapshot GC.
