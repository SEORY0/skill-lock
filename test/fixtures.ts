import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Env, resolveEnv } from "../src/core/env.js";

export interface Fixture {
  env: Env;
  /** Write (or overwrite) a file under the user config root. Posix rel path. */
  writeUser(rel: string, content: string): void;
  /** Write (or overwrite) a file under the project root. Posix rel path. */
  writeProject(rel: string, content: string): void;
}

function writeAt(root: string, rel: string, content: string): void {
  const parts = rel.split("/");
  const path = join(root, ...parts);
  mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
  writeFileSync(path, content);
}

/** A realistic fake Claude Code install: user config tree + project dir. */
export function makeFixture(): Fixture {
  const base = mkdtempSync(join(tmpdir(), "sl-fix-"));
  const claudeConfigDir = join(base, "claude-home");
  const cwd = join(base, "project");
  mkdirSync(cwd, { recursive: true });
  const env = resolveEnv({
    home: base,
    cwd,
    claudeConfigDir,
    stateDir: join(base, "state"),
  });

  const writeUser = (rel: string, content: string) => writeAt(claudeConfigDir, rel, content);
  const writeProject = (rel: string, content: string) => writeAt(cwd, rel, content);

  writeUser("skills/demo/SKILL.md", "---\nname: demo\n---\nDo the demo thing.\n");
  writeUser("skills/demo/scripts/run.sh", "#!/bin/sh\necho demo\n");
  writeUser("agents/reviewer.md", "You review code.\n");
  writeUser("commands/deploy.md", "Deploy the app.\n");
  writeUser("CLAUDE.md", "# User memory\n");
  writeUser(
    "plugins/installed_plugins.json",
    JSON.stringify({ marketplace: { plug: { version: "1.0.0" } } }),
  );
  writeUser("plugins/cache/marketplace/plug/1.0.0/plugin.json", '{"name":"plug"}\n');
  writeUser(
    "settings.json",
    JSON.stringify({
      model: "opus",
      hooks: { SessionStart: [{ hooks: [{ type: "command", command: "echo hi" }] }] },
      mcpServers: { db: { command: "db-mcp" } },
    }),
  );

  writeProject(".claude/skills/proj/SKILL.md", "---\nname: proj\n---\nProject skill.\n");
  writeProject("CLAUDE.md", "# Project instructions\n");
  writeProject(".mcp.json", JSON.stringify({ mcpServers: { api: { command: "api-mcp" } } }));
  writeProject(".claude/settings.json", JSON.stringify({ hooks: {} }));

  return { env, writeUser, writeProject };
}
