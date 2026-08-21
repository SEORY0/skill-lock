import { type Dirent, readdirSync } from "node:fs";
import { join } from "node:path";

const SKIP_NAMES = new Set([".DS_Store", "Thumbs.db"]);

/**
 * All regular files under root as sorted, POSIX-style relative paths.
 * Missing root yields []. Symlinked directories are not followed (loop safety).
 */
export function walkFiles(root: string): string[] {
  const results: string[] = [];
  const walk = (dir: string, rel: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_NAMES.has(entry.name)) continue;
      const relPath = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(join(dir, entry.name), relPath);
      else if (entry.isFile()) results.push(relPath);
    }
  };
  walk(root, "");
  return results.sort();
}
