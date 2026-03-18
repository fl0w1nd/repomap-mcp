import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

const CACHE_VERSION = 1;

interface CacheEntry<T> {
  version: number;
  mtime: number;
  data: T;
}

function getSystemCacheDir(): string {
  const platform = os.platform();
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Caches", "repomap-mcp");
  }
  if (platform === "win32") {
    return path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "repomap-mcp", "cache");
  }
  return path.join(process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache"), "repomap-mcp");
}

export class TagsCache {
  private cacheDir: string;

  constructor(root: string) {
    const rootHash = createHash("md5").update(path.resolve(root)).digest("hex").slice(0, 12);
    this.cacheDir = path.join(getSystemCacheDir(), rootHash);
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
