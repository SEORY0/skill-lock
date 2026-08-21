import { homedir } from "node:os";
import { join } from "node:path";

export interface Env {
  home: string;
  cwd: string;
  /** Root of the Claude Code config tree ($CLAUDE_CONFIG_DIR or ~/.claude). */
  claudeConfigDir: string;
  /** skill-lock state: user lockfile + snapshot store. Outside the watched tree. */
  stateDir: string;
}

export function resolveEnv(base: Partial<Env> = {}): Env {
  const home = base.home ?? homedir();
  return {
    home,
    cwd: base.cwd ?? process.cwd(),
    claudeConfigDir: base.claudeConfigDir ?? process.env.CLAUDE_CONFIG_DIR ?? join(home, ".claude"),
    stateDir: base.stateDir ?? process.env.SKILL_LOCK_STATE_DIR ?? join(home, ".skill-lock"),
  };
}
