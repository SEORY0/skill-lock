import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Env } from "../core/env.js";
import type { ArtifactRecord, ArtifactType, Scope } from "../core/types.js";
import { canonicalJson } from "../util/canonical.js";
import { walkFiles } from "../util/fswalk.js";
import { sha256 } from "../util/hash.js";
import type { HarnessAdapter } from "./adapter.js";

/** Settings keys that affect what the agent can do; everything else is noise. */
const SETTINGS_PROJECTIONS: ReadonlyArray<[key: string, type: ArtifactType]> = [
  ["hooks", "hooks-config"],
  ["mcpServers", "mcp-config"],
];

function toRecord(id: string, type: ArtifactType, content: Buffer): ArtifactRecord {
  return { id, type, sha256: sha256(content), size: content.length, content };
}

function readIfExists(path: string): Buffer | null {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}

function fromPosix(root: string, rel: string): string {
  return join(root, ...rel.split("/"));
}

function collectDir(root: string, dirRel: string, type: ArtifactType): ArtifactRecord[] {
  const dir = fromPosix(root, dirRel);
  return walkFiles(dir).map((rel) =>
    toRecord(`${dirRel}/${rel}`, type, readFileSync(fromPosix(dir, rel))),
  );
}

function collectFile(root: string, rel: string, type: ArtifactType): ArtifactRecord[] {
  const content = readIfExists(fromPosix(root, rel));
  return content === null ? [] : [toRecord(rel, type, content)];
}

/**
 * Security-relevant projections of a settings file. Canonical JSON of each key
 * so unrelated settings churn (model, theme, …) never causes drift noise.
 */
function collectProjections(root: string, rel: string): ArtifactRecord[] {
  const raw = readIfExists(fromPosix(root, rel));
  if (raw === null) return [];
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
  } catch {
    // Unparseable settings still get locked whole, so tampering cannot hide.
    return [toRecord(`${rel}#unparseable`, "hooks-config", raw)];
  }
  const records: ArtifactRecord[] = [];
  for (const [key, type] of SETTINGS_PROJECTIONS) {
    if (parsed[key] !== undefined) {
      records.push(toRecord(`${rel}#${key}`, type, Buffer.from(canonicalJson(parsed[key]))));
    }
  }
  return records;
}

function byId(a: ArtifactRecord, b: ArtifactRecord): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export const claudeCodeAdapter: HarnessAdapter = {
  name: "claude-code",

  detect(env: Env): boolean {
    return (
      existsSync(env.claudeConfigDir) ||
      existsSync(join(env.cwd, ".claude")) ||
      existsSync(join(env.cwd, ".mcp.json"))
    );
  },

  collect(scope: Scope, env: Env): ArtifactRecord[] {
    if (scope === "user") {
      const root = env.claudeConfigDir;
      return [
        ...collectDir(root, "skills", "skill"),
        ...collectDir(root, "agents", "agent"),
        ...collectDir(root, "commands", "command"),
        ...collectFile(root, "CLAUDE.md", "memory"),
        ...collectFile(root, "plugins/installed_plugins.json", "plugin-manifest"),
        ...collectDir(root, "plugins/cache", "plugin"),
        ...collectProjections(root, "settings.json"),
      ].sort(byId);
    }
    const root = env.cwd;
    return [
      ...collectDir(root, ".claude/skills", "skill"),
      ...collectDir(root, ".claude/agents", "agent"),
      ...collectDir(root, ".claude/commands", "command"),
      ...collectFile(root, "CLAUDE.md", "memory"),
      ...collectFile(root, ".mcp.json", "mcp-config"),
      ...collectProjections(root, ".claude/settings.json"),
      ...collectProjections(root, ".claude/settings.local.json"),
    ].sort(byId);
  },
};
