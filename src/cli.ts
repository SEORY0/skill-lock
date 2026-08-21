#!/usr/bin/env node
import { runApprove } from "./commands/approve.js";
import { type Io, processIo } from "./commands/common.js";
import { runDiff } from "./commands/diff.js";
import { runHook } from "./commands/hook.js";
import { runInit } from "./commands/init.js";
import { runStatus } from "./commands/status.js";
import { runVerify } from "./commands/verify.js";
import { resolveEnv } from "./core/env.js";
import { toolVersion } from "./version.js";

export { toolVersion };

const USAGE = `skill-lock — package-lock.json for AI agent skills

Usage: skill-lock <command> [options]

Commands:
  init      Snapshot skills/agents/hooks/plugins/MCP config as the trusted baseline
  verify    Check current state against the baseline (exit 1 on drift)
  diff      Show unified diffs of drifted artifacts
  approve   Accept changes into the baseline (approve <id-or-prefix>… | --all)
  status    Summarize lock state per scope
  hook      install|uninstall the Claude Code SessionStart auto-verify hook

Options:
  --scope user|project|all   Limit to one scope (default: all)
  --version                  Print version
  --help                     Show this help

Docs: https://github.com/SEORY0/skill-lock`;

export async function main(argv: string[], io: Io = processIo): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    io.out(USAGE);
    return command === undefined ? 2 : 0;
  }
  if (command === "--version" || command === "-v") {
    io.out(`skill-lock ${toolVersion()}`);
    return 0;
  }

  const env = resolveEnv();
  try {
    switch (command) {
      case "init":
        return await runInit(rest, env, io);
      case "verify":
        return await runVerify(rest, env, io);
      case "diff":
        return await runDiff(rest, env, io);
      case "approve":
        return await runApprove(rest, env, io);
      case "status":
        return await runStatus(rest, env, io);
      case "hook":
        return await runHook(rest, env, io);
      default:
        io.err(`unknown command: ${command}`);
        io.err(USAGE);
        return 2;
    }
  } catch (err) {
    io.err(`error: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url.endsWith("cli.js");
if (isDirectRun && process.env.SKILL_LOCK_NO_AUTORUN !== "1") {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      console.error(String(err));
      process.exitCode = 2;
    },
  );
}
