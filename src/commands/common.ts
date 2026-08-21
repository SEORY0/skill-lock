import { join } from "node:path";
import type { HarnessAdapter } from "../adapters/adapter.js";
import { claudeCodeAdapter } from "../adapters/claude-code.js";
import type { Env } from "../core/env.js";
import { ObjectStore } from "../core/store.js";
import type { Scope } from "../core/types.js";

export interface Io {
  out(line: string): void;
  err(line: string): void;
}

export const processIo: Io = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

export function parseScopes(value: string | undefined): Scope[] | null {
  switch (value ?? "all") {
    case "user":
      return ["user"];
    case "project":
      return ["project"];
    case "all":
      return ["user", "project"];
    default:
      return null;
  }
}

export function adapterFor(_env: Env): HarnessAdapter {
  return claudeCodeAdapter;
}

export function storeFor(env: Env): ObjectStore {
  return new ObjectStore(join(env.stateDir, "objects"));
}
