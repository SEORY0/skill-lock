import type { Env } from "../core/env.js";
import type { ArtifactRecord, Scope } from "../core/types.js";

export interface HarnessAdapter {
  name: string;
  detect(env: Env): boolean;
  collect(scope: Scope, env: Env): ArtifactRecord[];
}
