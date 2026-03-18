# repomap-mcp

[![npm version](https://img.shields.io/npm/v/repomap-mcp.svg)](https://www.npmjs.com/package/repomap-mcp)
[![license](https://img.shields.io/npm/l/repomap-mcp.svg)](https://github.com/fl0w1nd/repomap-mcp/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/repomap-mcp.svg)](https://nodejs.org)

> **[中文文档](./README.zh-CN.md)**

An MCP server and CLI tool that generates **ranked, token-budgeted code structure maps** using Tree-sitter AST analysis and PageRank. Designed for AI agents that need to quickly understand unfamiliar codebases.

Inspired by [aider](https://github.com/Aider-AI/aider)'s repo map, reimplemented in TypeScript via [RepoMapper](https://github.com/pdavis68/RepoMapper).

## Why repomap-mcp?

AI coding agents face a fundamental problem: **large codebases don't fit in a context window**. Without structural awareness, agents resort to guessing file paths, reading irrelevant code, or asking the user to point them to the right place.

| | Without repomap-mcp | With repomap-mcp |
|---|---|---|
| **Codebase understanding** | Blindly `cat` files one by one | Get a ranked structural overview in one call |
| **Finding related code** | Grep for strings, miss semantic connections | PageRank surfaces cross-file dependencies |
| **Token efficiency** | Read entire files, blow context budget | Token-budgeted output, only the important parts |
| **Multi-language repos** | Regex-based hacks per language | 40+ languages via Tree-sitter AST, zero config |
| **Task-specific focus** | Same flat file listing every time | Personalized ranking based on focus files and identifiers |

### Key Features

- **Semantic, not textual** — uses Tree-sitter AST to extract real definitions and references, not string matching
- **PageRank ranking** — files that are heavily referenced across the codebase rank higher, just like important web pages
- **Neighbor propagation** — when focusing on a type definition file, code that *uses* those types also gets boosted
- **Token-budgeted** — binary search automatically selects the maximum amount of relevant code that fits your budget
- **Context-aware rendering** — shows parent scopes (class/function signatures) around each definition, not raw line dumps
- **Disk cache** — parsed tags are cached per-file with mtime invalidation; subsequent runs are near-instant
- **Zero config** — auto-detects MCP mode, respects `.gitignore`, discovers languages by extension

## How It Works

```
Source files ──scan──▶ Tree-sitter AST ──extract──▶ Definitions & References
                                                            │
                                                            ▼
                                                  Cross-file ref graph
                                                            │
                                                            ▼
Token-budgeted output ◀──select── Ranked definitions ◀──PageRank──┘
```

1. **File discovery** — recursive scan respecting `.gitignore`
2. **AST parsing** — Tree-sitter (WASM) with [Aider's SCM queries](https://github.com/Aider-AI/aider/tree/main/aider/queries), 40+ languages
3. **Graph construction** — cross-file reference edges (file A references identifier defined in file B → A→B)
4. **PageRank** — personalized ranking with neighbor propagation for focus/priority files
5. **Token budgeting** — binary search to fit the most relevant definitions within a token limit
6. **Context rendering** — code snippets with parent scope context and elision

## Quick Start

### As an MCP Server

Add to your MCP client config (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "repomap": {
      "command": "npx",
      "args": ["-y", "repomap-mcp"]
    }
  }
}
```

The server auto-detects MCP mode when stdin is piped — no flags needed.

### As a CLI Tool

```bash
# Generate a repo map for the current directory
npx repomap-mcp --root .

# With token limit and verbose report
npx repomap-mcp --root /path/to/repo --map-tokens 4096 --verbose

# Focus on known files, boost specific identifiers
npx repomap-mcp --root . --focus-files src/db.ts --priority-idents "UserService"
```

## Use Cases

### 1. Explore an unfamiliar codebase

> *"I just cloned this repo. Give me a structural overview."*

The agent calls `repo_map` with just `projectRoot`. The output is a ranked list of the most important definitions across the entire codebase — entry points, core types, key functions — all within the token budget.

### 2. Investigate code around a known file

> *"I've read `src/lib/db.ts`. What else should I look at?"*

The agent sets `focusFiles: ["src/lib/db.ts"]`. The map now centers around `db.ts` — files that import its types, functions that call its exports — while `db.ts` itself is excluded since the agent already has it.

### 3. Locate a specific symbol

> *"Where is `handleWebSocket` defined and who calls it?"*

The agent calls `search_identifiers` with `query: "handleWebSocket"`. Returns definition sites and all reference sites with surrounding code context.

### 4. Task-focused deep dive

> *"Refactor the authentication flow. The key types are in `src/auth/types.ts` and the main logic is `AuthService`."*

The agent combines parameters:
```json
{
  "projectRoot": "/path/to/repo",
  "focusFiles": ["src/auth/types.ts"],
  "priorityIdentifiers": ["AuthService"],
  "tokenLimit": 4096
}
```

The output prioritizes: code related to `src/auth/types.ts` (neighbor propagation), any file defining or heavily using `AuthService` (×10 boost), all within 4096 tokens.

### Prompt Example

Here's a system prompt snippet showing how an AI agent can leverage repomap-mcp:

```
You have access to the `repo_map` tool. Use it to understand the codebase before
making changes:

1. On first interaction with a repo, call repo_map with just the projectRoot to
   get an overview.
2. After reading key files, pass them as focusFiles to discover related code you
   haven't seen yet.
3. When the user mentions specific functions or classes, pass them as
   priorityIdentifiers to surface their definitions and usage patterns.
4. Use search_identifiers to locate exact definition and reference sites for any
   symbol.
```

## MCP Tools

### `repo_map`

Generate a ranked repository map of code definitions.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectRoot` | `string` | **Required.** Absolute path to the repository root |
| `focusFiles` | `string[]` | Already-known files as ranking anchor (×20). Excluded from output |
| `additionalFiles` | `string[]` | Extra files to include in analysis |
| `priorityFiles` | `string[]` | Important files to boost in ranking (×5) |
| `priorityIdentifiers` | `string[]` | Identifier names to boost in ranking (×10) |
| `tokenLimit` | `number` | Max tokens for output (default: `8192`) |
| `excludeUnranked` | `boolean` | Exclude zero-PageRank files (default: `false`) |
| `forceRefresh` | `boolean` | Bypass tag cache (default: `false`) |

### `search_identifiers`

Search for code identifiers across the repository via AST analysis.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectRoot` | `string` | **Required.** Absolute path to the repository root |
| `query` | `string` | **Required.** Identifier name (case-insensitive substring match) |
| `maxResults` | `number` | Max results (default: `50`) |
| `includeDefinitions` | `boolean` | Include definition sites (default: `true`) |
| `includeReferences` | `boolean` | Include reference sites (default: `true`) |

## CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `--root <dir>` | `.` | Repository root directory |
| `--map-tokens <n>` | `8192` | Maximum tokens for output |
| `--focus-files <files...>` | — | Known files; ranking anchor, excluded from output (×20) |
| `--additional-files <files...>` | — | Extra files to include in analysis |
| `--priority-files <files...>` | — | Important files to boost (×5) |
| `--priority-idents <idents...>` | — | Important identifiers to boost (×10) |
| `--verbose` | `false` | Print report to stderr |
| `--force-refresh` | `false` | Bypass tag cache |
| `--exclude-unranked` | `false` | Hide zero-PageRank files |
| `--serve` | — | Force MCP stdio server mode |

## Supported Languages

Python, JavaScript, TypeScript, Go, Rust, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, Dart, Lua, Elixir, Elm, OCaml, Haskell, Julia, Fortran, Clojure, R, Zig, HCL/Terraform, Solidity, and more — **40+ languages** via Tree-sitter WASM grammars.

## Development

```bash
git clone https://github.com/fl0w1nd/repomap-mcp.git
cd repomap-mcp
pnpm install
pnpm build
```

### Debug with MCP Inspector

```bash
pnpm inspect
```

Opens a web UI at `http://localhost:6274` for interactive tool testing. Config stored in `mcp.json`.

### Architecture

```
src/
├── index.ts           Entry point — CLI / MCP mode dispatch
├── server.ts          MCP server and tool registration
├── cli.ts             CLI argument parsing
├── repomap.ts         Core pipeline orchestration
├── tags.ts            Tree-sitter tag extraction
├── pagerank.ts        PageRank algorithm
├── tree-context.ts    Code snippet rendering with context
├── file-discovery.ts  Recursive file scanning + .gitignore
├── languages.ts       Language detection from extensions
├── token-counter.ts   Token counting (gpt-tokenizer)
├── cache.ts           Disk-based tag cache
└── utils.ts           Shared types
queries/               Tree-sitter SCM queries (from Aider)
```

## License

[MIT](./LICENSE)
