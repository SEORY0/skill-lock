import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Env } from "../core/env.js";
import { readLockfile, writeLockfile } from "../core/lockfile.js";
import { adapterFor, type Io, storeFor } from "./common.js";

export const HOOK_COMMAND = "npx -y skill-lock verify --hook";

interface HookEntry {
  type?: string;
  command?: string;
  [key: string]: unknown;
}

interface HookMatcher {
  hooks?: HookEntry[];
  [key: string]: unknown;
}

/** Re-baseline the settings hooks projection so our own edit is not flagged as drift. */
function rebaselineSettingsProjection(env: Env, io: Io): void {
  const lock = readLockfile("user", env);
  if (lock === null) return;
  const id = "settings.json#hooks";
  const record = adapterFor(env)
    .collect("user", env)
    .find((r) => r.id === id);
  if (record === undefined) delete lock.artifacts[id];
  else {
    storeFor(env).write(record.content);
    lock.artifacts[id] = { type: record.type, sha256: record.sha256, size: record.size };
  }
  writeLockfile(lock, "user", env);
  io.out(`baseline updated for ${id}`);
}

export async function runHook(argv: string[], env: Env, io: Io): Promise<number> {
  const action = argv[0];
  if (action !== "install" && action !== "uninstall") {
    io.err("usage: skill-lock hook install|uninstall");
    return 2;
  }

  const settingsPath = join(env.claudeConfigDir, "settings.json");
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      io.err(`${settingsPath} is not valid JSON — fix it first`);
      return 2;
    }
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  settings.hooks = hooks;
  const sessionStart = (hooks.SessionStart ?? []) as HookMatcher[];
  hooks.SessionStart = sessionStart;
  const installed = sessionStart.some((m) =>
    (m.hooks ?? []).some((h) => h.command === HOOK_COMMAND),
  );

  if (action === "install") {
    if (installed) {
      io.out("SessionStart hook already installed");
      return 0;
    }
    sessionStart.push({ hooks: [{ type: "command", command: HOOK_COMMAND }] });
    io.out(`installed SessionStart hook in ${settingsPath}`);
  } else {
    if (!installed) {
      io.out("SessionStart hook is not installed");
      return 0;
    }
    for (const matcher of sessionStart) {
      if (matcher.hooks !== undefined) {
        matcher.hooks = matcher.hooks.filter((h) => h.command !== HOOK_COMMAND);
      }
    }
    hooks.SessionStart = sessionStart.filter((m) => (m.hooks?.length ?? 0) > 0);
    if ((hooks.SessionStart as HookMatcher[]).length === 0) delete hooks.SessionStart;
    io.out(`removed SessionStart hook from ${settingsPath}`);
  }

  mkdirSync(env.claudeConfigDir, { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  rebaselineSettingsProjection(env, io);
  return 0;
}
