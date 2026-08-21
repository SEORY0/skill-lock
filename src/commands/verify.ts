import { parseArgs } from "node:util";
import { compare } from "../core/compare.js";
import type { Env } from "../core/env.js";
import { readLockfile } from "../core/lockfile.js";
import type { DriftItem, Scope } from "../core/types.js";
import { adapterFor, type Io, parseScopes } from "./common.js";

export interface ScopedDrift extends DriftItem {
  scope: Scope;
}

export function collectDrift(scopes: Scope[], env: Env): { drift: ScopedDrift[]; locked: Scope[] } {
  const adapter = adapterFor(env);
  const drift: ScopedDrift[] = [];
  const locked: Scope[] = [];
  for (const scope of scopes) {
    const lock = readLockfile(scope, env);
    if (lock === null) continue;
    locked.push(scope);
    for (const item of compare(lock, adapter.collect(scope, env))) drift.push({ ...item, scope });
  }
  return { drift, locked };
}

export function formatDriftLine(item: ScopedDrift): string {
  return `  [${item.risk.toUpperCase()}] ${item.kind} ${item.type} ${item.scope}:${item.id}`;
}

export async function runVerify(argv: string[], env: Env, io: Io): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      scope: { type: "string" },
      hook: { type: "boolean" },
      json: { type: "boolean" },
    },
  });
  const scopes = parseScopes(values.scope);
  if (scopes === null) {
    io.err(`invalid --scope ${String(values.scope)} (use user|project|all)`);
    return 2;
  }

  const { drift, locked } = collectDrift(scopes, env);
  const hookMode = values.hook === true;

  if (values.json === true) {
    io.out(JSON.stringify(drift, null, 2));
    return drift.length > 0 && !hookMode ? 1 : 0;
  }

  if (locked.length === 0) {
    if (!hookMode) {
      io.err("no lockfile found — run `skill-lock init` first");
      return 2;
    }
    return 0;
  }

  if (drift.length === 0) {
    if (!hookMode) io.out(`ok: no drift (scopes: ${locked.join(", ")})`);
    return 0;
  }

  if (hookMode) {
    io.out("[skill-lock] WARNING: agent configuration changed since the locked baseline:");
    for (const item of drift) io.out(formatDriftLine(item));
    io.out(
      "[skill-lock] Treat unexpected changes as hostile. Review with `skill-lock diff`, accept with `skill-lock approve <id>`.",
    );
    return 0;
  }

  io.out(`drift detected (${drift.length} artifact${drift.length === 1 ? "" : "s"}):`);
  for (const item of drift) io.out(formatDriftLine(item));
  io.out("review: skill-lock diff  |  accept: skill-lock approve <id> | --all");
  return 1;
}
