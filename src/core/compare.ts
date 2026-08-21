import { assessRisk } from "./risk.js";
import type { ArtifactRecord, DriftItem, Lockfile, Risk } from "./types.js";

const RISK_ORDER: Record<Risk, number> = { high: 0, medium: 1, low: 2 };

/** Drift between the locked baseline and the currently collected artifacts. */
export function compare(lock: Lockfile, current: ArtifactRecord[]): DriftItem[] {
  const items: DriftItem[] = [];
  const currentById = new Map(current.map((r) => [r.id, r]));

  for (const [id, entry] of Object.entries(lock.artifacts)) {
    const now = currentById.get(id);
    if (now === undefined) {
      items.push({
        id,
        type: entry.type,
        kind: "removed",
        risk: assessRisk(entry.type, "removed"),
        oldSha: entry.sha256,
      });
    } else if (now.sha256 !== entry.sha256) {
      items.push({
        id,
        type: entry.type,
        kind: "modified",
        risk: assessRisk(entry.type, "modified"),
        oldSha: entry.sha256,
        newSha: now.sha256,
      });
    }
  }

  for (const record of current) {
    if (lock.artifacts[record.id] === undefined) {
      items.push({
        id: record.id,
        type: record.type,
        kind: "added",
        risk: assessRisk(record.type, "added"),
        newSha: record.sha256,
      });
    }
  }

  return items.sort(
    (a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
