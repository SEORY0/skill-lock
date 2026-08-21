# Contributing to skill-lock

Thanks for helping make agent configurations verifiable!

## Dev setup

```bash
git clone https://github.com/SEORY0/skill-lock
cd skill-lock
npm install
npm test        # build + node:test suite
npm run lint    # biome
```

Rules of the codebase:

- **Zero runtime dependencies.** Node builtins only. PRs adding a `dependencies`
  entry will be declined — this tool guards the supply chain, so it keeps none.
- Node >= 20, strict TypeScript, ESM.
- Windows is a first-class target; CI runs the suite on ubuntu/macos/windows.
- Conventional commits (`feat:`, `fix:`, `docs:`, …) — releases are automated from
  commit messages via release-please.
- Every behavior change comes with a test. The fixture helper in
  `test/fixtures.ts` builds a fake Claude Code install in a tmpdir — use it.

## Writing a harness adapter (most wanted!)

Supporting a new harness (OpenClaw, Codex, opencode, …) means implementing one
interface in `src/adapters/`:

```ts
export interface HarnessAdapter {
  name: string;                                  // "openclaw"
  detect(env: Env): boolean;                     // is this harness present?
  collect(scope: "user" | "project", env: Env): ArtifactRecord[];
}
```

Guidelines:

1. **Enumerate everything the agent loads**: skills/instructions, hook scripts,
   plugin bodies, MCP/tool configs, memory files.
2. **Project security-relevant keys** out of mixed config files (see
   `collectProjections` in `src/adapters/claude-code.ts`) so unrelated settings
   churn doesn't create drift noise.
3. Ids are POSIX-style relative paths (`skills/foo/SKILL.md`) or
   `file#key` for projections.
4. Make every root injectable through `Env` so tests can run against a tmpdir
   fixture. Add a fixture builder + tests mirroring `test/claude-code.test.ts`.

Open an [adapter request](https://github.com/SEORY0/skill-lock/issues/new/choose)
first if you want design feedback before coding.

## Releases (maintainers)

Merging to `main` with conventional commits feeds
[release-please](https://github.com/googleapis/release-please); merging its release
PR tags, publishes a GitHub Release, and publishes to npm with `--provenance`.
