import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  "__pycache__",
  "venv",
  "env",
  ".venv",
  ".env",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "target",
  "vendor",
  ".bundle",
  "coverage",
  ".nyc_output",
  ".tox",
  "egg-info",
]);

export function findSrcFiles(directory: string): string[] {
  const ig = loadGitignore(directory);
  const results: string[] = [];
  walk(directory, directory, ig, results);
  return results;
}

function loadGitignore(root: string): Ignore {
  const ig = ignore();
  try {
    const content = readFileSync(path.join(root, ".gitignore"), "utf-8");
    ig.add(content);
  } catch {
    // no .gitignore
  }
  return ig;
}

function walk(
  dir: string,
  root: string,
  ig: Ignore,
  results: string[],
): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(root, fullPath);

    if (entry.name.startsWith(".")) continue;

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      if (ig.ignores(relPath + "/")) continue;
      walk(fullPath, root, ig, results);
    } else if (entry.isFile()) {
      if (ig.ignores(relPath)) continue;
      results.push(fullPath);
    }
  }
}
