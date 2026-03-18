import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Parser, Language, Query } from "web-tree-sitter";
import type { Tag } from "./utils.js";
import { filenameToLang, type SupportedLanguage } from "./languages.js";
import { TagsCache } from "./cache.js";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QUERIES_DIR = path.resolve(__dirname, "..", "queries");
const LANGUAGE_PACK_DIR = path.join(QUERIES_DIR, "tree-sitter-language-pack");
const LANGUAGES_DIR = path.join(QUERIES_DIR, "tree-sitter-languages");

const QUERY_NAME_ALIASES: Partial<Record<SupportedLanguage, string[]>> = {
  c_sharp: ["csharp", "c_sharp"],
  tsx: ["typescript"],
};

let parserInitialized = false;

const languageCache = new Map<string, Language>();
const queryCache = new Map<string, Query>();

export async function initParser(): Promise<void> {
  if (parserInitialized) return;
  await Parser.init();
  parserInitialized = true;
}

function getWasmPath(lang: SupportedLanguage): string {
  const wasmsDir = path.dirname(require.resolve("tree-sitter-wasms/package.json"));
  return path.join(wasmsDir, "out", `tree-sitter-${lang}.wasm`);
}

async function loadLanguage(lang: SupportedLanguage): Promise<Language> {
  const cached = languageCache.get(lang);
  if (cached) return cached;

  const wasmPath = getWasmPath(lang);
  const language = await Language.load(wasmPath);
  languageCache.set(lang, language);
  return language;
}

function getQueryPath(lang: SupportedLanguage): string | null {
  const names = QUERY_NAME_ALIASES[lang] ?? [lang];

  for (const name of names) {
    const packPath = path.join(LANGUAGE_PACK_DIR, `${name}-tags.scm`);
    if (existsSync(packPath)) return packPath;
  }

  for (const name of names) {
    const langPath = path.join(LANGUAGES_DIR, `${name}-tags.scm`);
    if (existsSync(langPath)) return langPath;
  }

  return null;
}

function loadQuery(language: Language, lang: SupportedLanguage): Query | null {
  const cached = queryCache.get(lang);
  if (cached) return cached;

  const queryPath = getQueryPath(lang);
  if (!queryPath) return null;

  const source = readFileSync(queryPath, "utf-8");
  try {
    const query = new Query(language, source);
    queryCache.set(lang, query);
    return query;
  } catch {
    return null;
  }
}

export async function getTagsRaw(
  fname: string,
  relFname: string,
): Promise<Tag[]> {
  const lang = filenameToLang(fname);
  if (!lang) return [];

  await initParser();

  let language: Language;
  try {
    language = await loadLanguage(lang);
  } catch {
    return [];
  }

  const query = loadQuery(language, lang);
  if (!query) return [];

  let code: string;
  try {
    code = readFileSync(fname, "utf-8");
  } catch {
    return [];
  }

  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(code);
  if (!tree) return [];

  const tags: Tag[] = [];
  const captures = query.captures(tree.rootNode);

  for (const capture of captures) {
    const captureName = capture.name;
    let kind: "def" | "ref" | null = null;

    if (captureName.startsWith("name.definition")) {
      kind = "def";
    } else if (captureName.startsWith("name.reference")) {
      kind = "ref";
    }

    if (!kind) continue;

    const node = capture.node;
    tags.push({
      relFname,
      fname,
      line: node.startPosition.row + 1,
      name: node.text,
      kind,
    });
  }

  parser.delete();
  tree.delete();

  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = `${tag.relFname}:${tag.line}:${tag.name}:${tag.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getTags(
  fname: string,
  relFname: string,
  cache: TagsCache | null,
  forceRefresh: boolean,
): Promise<Tag[]> {
  if (cache && !forceRefresh) {
    const cached = cache.get<Tag[]>(fname);
    if (cached) return cached;
  }

  const tags = await getTagsRaw(fname, relFname);

  if (cache) {
    cache.set(fname, tags);
  }

  return tags;
}
