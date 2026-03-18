import path from "node:path";

export const SUPPORTED_LANGUAGES = [
  "bash",
  "c",
  "c_sharp",
  "cpp",
  "css",
  "dart",
  "elisp",
  "elixir",
  "elm",
  "go",
  "html",
  "java",
  "javascript",
  "json",
  "kotlin",
  "lua",
  "objc",
  "ocaml",
  "php",
  "python",
  "ql",
  "ruby",
  "rust",
  "scala",
  "swift",
  "toml",
  "tsx",
  "typescript",
  "yaml",
  "zig",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const EXTENSION_MAP: Record<string, SupportedLanguage> = {
  ".py": "python",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".hxx": "cpp",
  ".cs": "c_sharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".scala": "scala",
  ".sc": "scala",
  ".dart": "dart",
  ".lua": "lua",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".el": "elisp",
  ".ex": "elixir",
  ".exs": "elixir",
  ".elm": "elm",
  ".ml": "ocaml",
  ".mli": "ocaml",
  ".m": "objc",
  ".zig": "zig",
  ".ql": "ql",
  ".sol": "solidity" as SupportedLanguage,
  ".html": "html",
  ".css": "css",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
};

export function filenameToLang(filename: string): SupportedLanguage | null {
  const ext = path.extname(filename).toLowerCase();
  return EXTENSION_MAP[ext] ?? null;
}

export function isSupportedFile(filename: string): boolean {
  return filenameToLang(filename) !== null;
}
