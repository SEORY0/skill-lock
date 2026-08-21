import { parseArgs } from "node:util";
import type { Env } from "../core/env.js";
import { lockfilePath, readLockfile } from "../core/lockfile.js";
import { adapterFor, type Io, parseScopes } from "./common.js";
import { collectDrift } from "./verify.js";

export async function runStatus(argv: string[], env: Env, io: Io): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { scope: { type: "string" } },
  });
  const scopes = parseScopes(values.scope);
  if (scopes === null) {
    io.err(`invalid --scope ${String(values.scope)} (use user|project|all)`);
    return 2;
  }

  io.out(`harness: ${adapterFor(env).name}`);
  for (const scope of scopes) {
    const lock = readLockfile(scope, env);
    if (lock === null) {
      io.out(`${scope}: not initialized (skill-lock init --scope ${scope})`);
      continue;
    }
    const { drift } = collectDrift([scope], env);
    const high = drift.filter((d) => d.risk === "high").length;
    const medium = drift.filter((d) => d.risk === "medium").length;
    const driftNote =
      drift.length === 0 ? "clean" : `${drift.length} drifted (${high} high, ${medium} medium)`;
    io.out(
      `${scope}: ${Object.keys(lock.artifacts).length} artifacts locked at ${lock.generatedAt} — ${driftNote}`,
    );
    io.out(`  lockfile: ${lockfilePath(scope, env)}`);
  }
  return 0;
}
