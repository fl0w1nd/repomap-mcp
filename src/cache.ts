import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const CACHE_VERSION = 1;

interface CacheEntry<T> {
  version: number;
  mtime: number;
  data: T;
}

export class TagsCache {
  private cacheDir: string;

  constructor(root: string) {
    this.cacheDir = path.join(root, ".cache", "repomap");
    mkdirSync(this.cacheDir, { recursive: true });
  }

  private keyFor(fname: string): string {
    const hash = createHash("md5").update(fname).digest("hex");
    return path.join(this.cacheDir, `${hash}.json`);
  }

  get<T>(fname: string): T | null {
    const cacheFile = this.keyFor(fname);
    if (!existsSync(cacheFile)) return null;

    try {
      const raw = readFileSync(cacheFile, "utf-8");
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (entry.version !== CACHE_VERSION) return null;

      const stat = statSync(fname);
      if (stat.mtimeMs !== entry.mtime) return null;

      return entry.data;
    } catch {
      return null;
    }
  }

  set<T>(fname: string, data: T): void {
    const cacheFile = this.keyFor(fname);
    try {
      const stat = statSync(fname);
      const entry: CacheEntry<T> = {
        version: CACHE_VERSION,
        mtime: stat.mtimeMs,
        data,
      };
      writeFileSync(cacheFile, JSON.stringify(entry));
    } catch {
      // ignore write errors
    }
  }

  clear(): void {
    try {
      rmSync(this.cacheDir, { recursive: true, force: true });
      mkdirSync(this.cacheDir, { recursive: true });
    } catch {
      // ignore
    }
  }
}
