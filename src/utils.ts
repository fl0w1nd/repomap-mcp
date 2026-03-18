import { readFileSync } from "node:fs";

export interface Tag {
  relFname: string;
  fname: string;
  line: number;
  name: string;
  kind: "def" | "ref";
}

export interface RankedTag {
  rank: number;
  tag: Tag;
}

export interface RepoMapOptions {
  root: string;
  mapTokens?: number;
  chatFiles?: string[];
  otherFiles?: string[];
  mentionedFiles?: string[];
  mentionedIdents?: string[];
  model?: string;
  maxContextWindow?: number;
  forceRefresh?: boolean;
  excludeUnranked?: boolean;
  verbose?: boolean;
}

export interface RepoMapResult {
  map: string;
  report: {
    totalFilesConsidered: number;
    definitionMatches: number;
    referenceMatches: number;
    excluded: Record<string, string>;
  };
}

export interface SearchResult {
  file: string;
  line: number;
  name: string;
  kind: "def" | "ref";
  context: string;
}

export function readText(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}
