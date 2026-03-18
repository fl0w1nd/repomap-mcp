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
  focusFiles?: string[];
  additionalFiles?: string[];
  priorityFiles?: string[];
  priorityIdentifiers?: string[];
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

