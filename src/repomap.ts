import path from "node:path";
import type {
  Tag,
  RankedTag,
  RepoMapOptions,
  RepoMapResult,
  SearchResult,
} from "./utils.js";
import { findSrcFiles } from "./file-discovery.js";
import { isSupportedFile } from "./languages.js";
import { getTags, initParser } from "./tags.js";
import { pagerank, type GraphEdge } from "./pagerank.js";
import { renderTreeContext } from "./tree-context.js";
import { countTokens } from "./token-counter.js";
import { TagsCache } from "./cache.js";
import { readFileSync } from "node:fs";

const DEFAULT_MAP_TOKENS = 8192;

export class RepoMap {
  private root: string;
  private mapTokens: number;
  private verbose: boolean;
  private cache: TagsCache;

  constructor(root: string, options: Partial<RepoMapOptions> = {}) {
    this.root = path.resolve(root);
    this.mapTokens = options.mapTokens ?? DEFAULT_MAP_TOKENS;
    this.verbose = options.verbose ?? false;
    this.cache = new TagsCache(this.root);
  }

  async getRepoMap(options: Partial<RepoMapOptions> = {}): Promise<RepoMapResult> {
    await initParser();

    const focusFiles = (options.focusFiles ?? []).map((f) => path.resolve(this.root, f));
    const additionalFiles = (options.additionalFiles ?? []).map((f) => path.resolve(this.root, f));
    const priorityFiles = new Set((options.priorityFiles ?? []).map((f) => path.resolve(this.root, f)));
    const priorityIdentifiers = new Set(options.priorityIdentifiers ?? []);
    const forceRefresh = options.forceRefresh ?? false;
    const excludeUnranked = options.excludeUnranked ?? false;
    const maxTokens = options.mapTokens ?? this.mapTokens;

    const allSrcFiles = findSrcFiles(this.root).filter(isSupportedFile);
    const fileSet = new Set([...focusFiles, ...additionalFiles, ...allSrcFiles]);
    const allFiles = Array.from(fileSet);

    const report = {
      totalFilesConsidered: allFiles.length,
      definitionMatches: 0,
      referenceMatches: 0,
      excluded: {} as Record<string, string>,
    };

    const allTags: Tag[] = [];
    for (const fname of allFiles) {
      const relFname = path.relative(this.root, fname);
      const tags = await getTags(fname, relFname, this.cache, forceRefresh);
      allTags.push(...tags);
    }

    for (const tag of allTags) {
      if (tag.kind === "def") report.definitionMatches++;
      else report.referenceMatches++;
    }

    const rankedTags = this.getRankedTags(
      allTags,
      allFiles,
      focusFiles,
      priorityFiles,
      priorityIdentifiers,
    );

    if (excludeUnranked) {
      const filtered = rankedTags.filter((rt) => rt.rank > 0);
      rankedTags.length = 0;
      rankedTags.push(...filtered);
    }

    const map = this.buildMap(rankedTags, focusFiles, maxTokens);
    return { map, report };
  }

  async searchIdentifiers(
    query: string,
    options: {
      maxResults?: number;
      contextLines?: number;
      includeDefinitions?: boolean;
      includeReferences?: boolean;
    } = {},
  ): Promise<SearchResult[]> {
    await initParser();

    const maxResults = options.maxResults ?? 50;
    const includeDefinitions = options.includeDefinitions ?? true;
    const includeReferences = options.includeReferences ?? true;
    const queryLower = query.toLowerCase();

    const allSrcFiles = findSrcFiles(this.root).filter(isSupportedFile);
    const allTags: Tag[] = [];

    for (const fname of allSrcFiles) {
      const relFname = path.relative(this.root, fname);
      const tags = await getTags(fname, relFname, this.cache, false);
      allTags.push(...tags);
    }

    const matched = allTags.filter((tag) => {
      if (!tag.name.toLowerCase().includes(queryLower)) return false;
      if (tag.kind === "def" && !includeDefinitions) return false;
      if (tag.kind === "ref" && !includeReferences) return false;
      return true;
    });

    matched.sort((a, b) => {
      if (a.kind === "def" && b.kind !== "def") return -1;
      if (a.kind !== "def" && b.kind === "def") return 1;
      return a.name.localeCompare(b.name);
    });

    const results: SearchResult[] = [];
    for (const tag of matched.slice(0, maxResults)) {
      let context = "";
      try {
        const code = readFileSync(tag.fname, "utf-8");
        context = renderTreeContext(code, [tag.line]);
      } catch {
        // ignore
      }
      results.push({
        file: tag.relFname,
        line: tag.line,
        name: tag.name,
        kind: tag.kind,
        context,
      });
    }

    return results;
  }

  private getRankedTags(
    allTags: Tag[],
    allFiles: string[],
    focusFiles: string[],
    priorityFiles: Set<string>,
    priorityIdentifiers: Set<string>,
  ): RankedTag[] {
    const defines = new Map<string, Set<string>>();
    const references = new Map<string, Set<string>>();

    for (const tag of allTags) {
      const map = tag.kind === "def" ? defines : references;
      let set = map.get(tag.name);
      if (!set) {
        set = new Set();
        map.set(tag.name, set);
      }
      set.add(tag.relFname);
    }

    const nodes = new Set(allFiles.map((f) => path.relative(this.root, f)));
    const edges: GraphEdge[] = [];

    for (const [name, refFnames] of references) {
      const defFnames = defines.get(name);
      if (!defFnames) continue;

      for (const refFname of refFnames) {
        for (const defFname of defFnames) {
          if (refFname !== defFname) {
            edges.push({ from: refFname, to: defFname, name });
          }
        }
      }
    }

    const personalization = new Map<string, number>();
    const focusRelFiles = new Set(focusFiles.map((f) => path.relative(this.root, f)));
    for (const relFname of focusRelFiles) {
      personalization.set(relFname, 100.0);
    }

    const ranks = pagerank(nodes, edges, personalization.size > 0 ? personalization : undefined);

    const priorityRelFiles = new Set(
      Array.from(priorityFiles).map((f) => path.relative(this.root, f)),
    );

    const rankedTags: RankedTag[] = [];
    for (const tag of allTags) {
      if (tag.kind !== "def") continue;

      const fileRank = ranks.get(tag.relFname) ?? 0;
      let boost = 1.0;
      if (focusRelFiles.has(tag.relFname)) boost *= 20.0;
      if (priorityIdentifiers.has(tag.name)) boost *= 10.0;
      if (priorityRelFiles.has(tag.relFname)) boost *= 5.0;

      rankedTags.push({ rank: fileRank * boost, tag });
    }

    rankedTags.sort((a, b) => b.rank - a.rank);
    return rankedTags;
  }

  private buildMap(
    rankedTags: RankedTag[],
    focusFiles: string[],
    maxTokens: number,
  ): string {
    const focusRelFiles = new Set(focusFiles.map((f) => path.relative(this.root, f)));

    let left = 0;
    let right = rankedTags.length;
    let bestOutput = "";

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const subset = rankedTags.slice(0, mid);
      const output = this.renderTags(subset, focusRelFiles);
      const tokens = countTokens(output);

      if (tokens <= maxTokens) {
        bestOutput = output;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return bestOutput;
  }

  private renderTags(tags: RankedTag[], focusRelFiles: Set<string>): string {
    const byFile = new Map<string, RankedTag[]>();
    for (const rt of tags) {
      const existing = byFile.get(rt.tag.relFname) ?? [];
      existing.push(rt);
      byFile.set(rt.tag.relFname, existing);
    }

    const sortedFiles = Array.from(byFile.entries()).sort((a, b) => {
      const maxA = Math.max(...a[1].map((rt) => rt.rank));
      const maxB = Math.max(...b[1].map((rt) => rt.rank));
      return maxB - maxA;
    });

    const parts: string[] = [];
    for (const [relFname, fileTags] of sortedFiles) {
      if (focusRelFiles.has(relFname)) continue;

      const maxRank = Math.max(...fileTags.map((rt) => rt.rank));
      const lois = fileTags.map((rt) => rt.tag.line);

      let code: string;
      try {
        code = readFileSync(path.resolve(this.root, relFname), "utf-8");
      } catch {
        continue;
      }

      const rendered = renderTreeContext(code, lois);
      if (!rendered) continue;

      parts.push(`${relFname}:\n(Rank value: ${maxRank.toFixed(4)})\n\n${rendered}`);
    }

    return parts.join("\n\n");
  }
}
