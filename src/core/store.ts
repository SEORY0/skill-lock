import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { sha256 } from "../util/hash.js";

/** Gzip content-addressable store: one object per sha256 of the raw content. */
export class ObjectStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private pathFor(sha: string): string {
    return join(this.dir, sha);
  }

  has(sha: string): boolean {
    return existsSync(this.pathFor(sha));
  }

  /** Idempotent; returns the sha256 of content. */
  write(content: Buffer): string {
    const sha = sha256(content);
    if (!this.has(sha)) {
      mkdirSync(this.dir, { recursive: true });
      writeFileSync(this.pathFor(sha), gzipSync(content));
    }
    return sha;
  }

  read(sha: string): Buffer {
    let compressed: Buffer;
    try {
      compressed = readFileSync(this.pathFor(sha));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`snapshot object not found: ${sha}`);
      }
      throw err;
    }
    return gunzipSync(compressed);
  }
}
