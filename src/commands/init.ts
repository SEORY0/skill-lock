import { parseArgs } from "node:util";
import type { Env } from "../core/env.js";
import { buildLockfile, lockfilePath, readLockfile, writeLockfile } from "../core/lockfile.js";
import { toolVersion } from "../version.js";
import { adapterFor, type Io, parseScopes, storeFor } from "./common.js";

export async function runInit(argv: string[], env: Env, io: Io): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { scope: { type: "string" }, force: { type: "boolean" } },
  });
  const scopes = parseScopes(values.scope);
  if (scopes === null) {
    io.err(`invalid --scope ${String(values.scope)} (use user|project|all)`);
    return 2;
  }

  for (const scope of scopes) {
    if (readLockfile(scope, env) !== null && values.force !== true) {
      io.err(
        `${scope}: lockfile already exists at ${lockfilePath(scope, env)} (use --force to re-baseline)`,
      );
      return 2;
    }
  }

  const adapter = adapterFor(env);
  const store = storeFor(env);
  for (const scope of scopes) {
    const records = adapter.collect(scope, env);
    for (const record of records) store.write(record.content);
    writeLockfile(buildLockfile(records, scope, adapter.name, toolVersion()), scope, env);
    io.out(`${scope}: locked ${records.length} artifacts → ${lockfilePath(scope, env)}`);
  }
  return 0;
}
