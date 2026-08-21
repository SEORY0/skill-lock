import { parseArgs } from "node:util";
import { compare } from "../core/compare.js";
import { isProbablyBinary, unifiedDiff } from "../core/difftext.js";
import type { Env } from "../core/env.js";
import { readLockfile } from "../core/lockfile.js";
import { adapterFor, type Io, parseScopes, storeFor } from "./common.js";

function matches(id: string, filters: string[]): boolean {
  return filters.length === 0 || filters.some((f) => id === f || id.startsWith(f));
}

export async function runDiff(argv: string[], env: Env, io: Io): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { scope: { type: "string" } },
    allowPositionals: true,
  });
  const scopes = parseScopes(values.scope);
  if (scopes === null) {
    io.err(`invalid --scope ${String(values.scope)} (use user|project|all)`);
    return 2;
  }

  const adapter = adapterFor(env);
  const store = storeFor(env);
  let shown = 0;
  for (const scope of scopes) {
    const lock = readLockfile(scope, env);
    if (lock === null) continue;
    const records = adapter.collect(scope, env);
    const byId = new Map(records.map((r) => [r.id, r]));
    for (const item of compare(lock, records)) {
      if (!matches(item.id, positionals)) continue;
      shown++;
      io.out(`# ${scope}:${item.id} (${item.kind}, risk: ${item.risk})`);

      let oldBuf: Buffer = Buffer.alloc(0);
      if (item.oldSha !== undefined) {
        try {
          oldBuf = store.read(item.oldSha);
        } catch {
          io.out("  baseline snapshot missing — cannot show content diff");
          continue;
        }
      }
      const newBuf = byId.get(item.id)?.content ?? Buffer.alloc(0);

      if (isProbablyBinary(oldBuf) || isProbablyBinary(newBuf)) {
        io.out(
          `  binary artifacts differ: ${item.oldSha ?? "(none)"} (${oldBuf.length}B) → ${item.newSha ?? "(none)"} (${newBuf.length}B)`,
        );
        continue;
      }
      const text = unifiedDiff(
        oldBuf.toString("utf8"),
        newBuf.toString("utf8"),
        `a/${item.id}`,
        `b/${item.id}`,
      );
      if (text !== "") io.out(text.trimEnd());
    }
  }
  if (shown === 0) {
    io.out(
      positionals.length > 0 ? "nothing to diff matching filters" : "nothing to diff — no drift",
    );
  }
  return 0;
}
