export type ArtifactType =
  | "skill"
  | "agent"
  | "command"
  | "memory"
  | "plugin"
  | "plugin-manifest"
  | "hooks-config"
  | "mcp-config";

export type Scope = "user" | "project";

export interface ArtifactRecord {
  /** POSIX-style id, e.g. "skills/foo/SKILL.md" or "settings.json#hooks". */
  id: string;
  type: ArtifactType;
  sha256: string;
  size: number;
  /** Exact bytes that were hashed. */
  content: Buffer;
}

export interface LockEntry {
  type: ArtifactType;
  sha256: string;
  size: number;
}

export interface Lockfile {
  lockfileVersion: 1;
  generatedAt: string;
  tool: { name: string; version: string };
  harness: string;
  scope: Scope;
  artifacts: Record<string, LockEntry>;
}

export type ChangeKind = "added" | "modified" | "removed";
export type Risk = "high" | "medium" | "low";

export interface DriftItem {
  id: string;
  type: ArtifactType;
  kind: ChangeKind;
  risk: Risk;
  oldSha?: string;
  newSha?: string;
}
