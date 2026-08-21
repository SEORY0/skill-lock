#!/usr/bin/env node
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function toolVersion(): string {
  const pkg = require("../../package.json") as { version: string };
  return pkg.version;
}

export async function main(argv: string[]): Promise<number> {
  if (argv.includes("--version")) {
    process.stdout.write(`skill-lock ${toolVersion()}\n`);
    return 0;
  }
  process.stdout.write("skill-lock: no command given (try --help)\n");
  return 2;
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url.endsWith("cli.js");
if (isDirectRun && process.env.SKILL_LOCK_NO_AUTORUN !== "1") {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
