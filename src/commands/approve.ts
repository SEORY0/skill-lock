import { parseArgs } from "node:util";
import { compare } from "../core/compare.js";
import type { Env } from "../core/env.js";
import { readLockfile, writeLockfile } from "../core/lockfile.js";
import type { Scope } from "../core/types.js";
import { adapterFor, type Io, parseScopes, storeFor } from "./common.js";

/** Accept current state for drifted artifacts matching filters ("all" = everything). */
export function approveItems(scope: Scope, env: Env, filters: string[] | "all"): string[] {
  const lock = readLockfile(scope, env);
  if (lock === null) return [];
  const store = storeFor(env);
  const records = adapterFor(env).collect(scope, env);
  const byId = new Map(records.map((r) => [r.id, r]));

  const approved: string[] = [];
  for (const item of compare(lock, records)) {
    if (filters !== "all" && !filters.some((f) => item.id === f || item.id.startsWith(f))) {
      continue;
    }
    if (item.kind === "removed") {
      delete lock.artifacts[item.id];
    } else {
      const record = byId.get(item.id);
      if (record === undefined) continue;
      store.write(record.content);
      lock.artifacts[item.id] = { type: record.type, sha256: record.sha256, size: record.size };
    }
    approved.push(item.id);
  }
  if (approved.length > 0) {
    lock.generatedAt = new Date().toISOString();
    writeLockfile(lock, scope, env);
  }
  return approved;
}

export async function runApprove(argv: string[], env: Env, io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { scope: { type: "string" }, all: { type: "boolean" } },
    allowPositionals: true,
  });
  const scopes = parseScopes(values.scope);
  if (scopes === null) {
    io.err(`invalid --scope ${String(values.scope)} (use user|project|all)`);
    return 2;
  }
  if (values.all !== true && positionals.length === 0) {
    io.err("usage: skill-lock approve <id-or-prefix>… | --all");
    return 2;
  }

  let total = 0;
  for (const scope of scopes) {
    for (const id of approveItems(scope, env, values.all === true ? "all" : positionals)) {
      io.out(`approved: ${scope}:${id}`);
      total++;
    }
  }
  if (total === 0) io.out("nothing to approve");
  return 0;
}
