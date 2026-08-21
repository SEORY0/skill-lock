import type { ArtifactType, ChangeKind, Risk } from "./types.js";

/**
 * Risk of an unapproved change, by artifact type and change kind.
 * See docs/superpowers/specs/2026-08-21-skill-lock-design.md for the rationale.
 */
export function assessRisk(type: ArtifactType, kind: ChangeKind): Risk {
  if (kind === "removed") return "medium";
  switch (type) {
    case "hooks-config":
    case "mcp-config":
    case "skill":
    case "agent":
    case "command":
      return "high";
    case "plugin":
      // Modified in place = classic persistence attack; a new file usually
      // arrives with a legitimate plugin install/update.
      return kind === "modified" ? "high" : "medium";
    case "plugin-manifest":
    case "memory":
      return "medium";
  }
}
