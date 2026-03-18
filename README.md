# repomap-mcp

A repository map generator that uses Tree-sitter AST analysis and PageRank to produce ranked, token-budgeted code structure summaries. Works as both a standalone CLI tool and an MCP (Model Context Protocol) stdio server.

Inspired by [aider](https://github.com/Aider-AI/aider)'s repo map feature, reimplemented in TypeScript via [RepoMapper](https://github.com/pdavis68/RepoMapper).

## How it works

1. **File discovery** — recursively scans the repository, respecting `.gitignore` rules
2. **AST parsing** — uses Tree-sitter (WASM) with SCM queries from Aider to extract definitions and references across 40+ languages
3. **Graph construction** — builds a cross-file reference graph (file A references identifier defined in file B → edge A→B)
4. **PageRank** — ranks files by importance using personalized PageRank, with configurable boost for focus/priority files
5. **Token budgeting** — binary-searches over ranked tags to fit the most relevant definitions within a token limit
6. **Context rendering** — renders code snippets with structural context (parent scopes, elided sections)

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### CLI mode

```bash
# Generate a repo map for the current directory
node dist/index.js

# With options
node dist/index.js --root /path/to/repo --map-tokens 4096 --verbose

# Focus on specific files and boost an identifier
node dist/index.js --focus-files src/main.ts --priority-idents "RepoMap"
```

### MCP server mode

When stdin is piped (launched by an MCP client), the server automatically enters MCP mode — no flag needed. You can also force it with `--serve`.

Configure in your MCP client (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "repomap": {
      "command": "node",
      "args": ["/absolute/path/to/repomap-mcp/dist/index.js"]
    }
  }
}
```

### MCP tools

| Tool | Description |
|------|-------------|
| `repo_map` | Generate a ranked repository map within a token budget |
| `search_identifiers` | Search for code identifiers (functions, classes, variables) with context |

## Debugging with MCP Inspector

[MCP Inspector](https://github.com/modelcontextprotocol/inspector) provides a web UI for interactively testing and debugging MCP tools, resources, and notifications.

```bash
pnpm inspect
```

The Inspector UI opens at `http://localhost:6274`. From there you can:

- Browse registered tools (`repo_map`, `search_identifiers`) and their schemas
- Execute tools with custom inputs and view JSON responses
- Monitor server logs and notifications in real time

Server configuration is stored in `mcp.json` at the project root. No build step is needed — it runs TypeScript source directly via tsx.

## CLI options

| Option | Default | Description |
|--------|---------|-------------|
| `--root <dir>` | `.` | Repository root directory |
| `--map-tokens <n>` | `8192` | Maximum tokens for the output |
| `--focus-files <files...>` | — | Files already known; ranking anchor, excluded from output (×20 boost) |
| `--additional-files <files...>` | — | Extra files to include in analysis |
| `--priority-files <files...>` | — | Important files to boost in ranking (×5) |
| `--priority-idents <idents...>` | — | Important identifiers to boost in ranking (×10) |
| `--verbose` | `false` | Show report on stderr |
| `--force-refresh` | `false` | Bypass tag cache |
| `--exclude-unranked` | `false` | Hide files with zero PageRank |
| `--serve` | — | Force MCP stdio server mode |

## Supported languages

Python, JavaScript, TypeScript, Go, Rust, Java, C, C++, C#, Ruby, PHP, Swift, Kotlin, Scala, Dart, Lua, Elixir, Elm, OCaml, Haskell, Julia, Fortran, Clojure, R, Zig, HCL/Terraform, Solidity, and more (40+ via Tree-sitter WASM grammars).

## Architecture

```
src/
├── index.ts           # Entry point: CLI / MCP mode dispatch
├── server.ts          # MCP server with tool registration
├── cli.ts             # CLI argument parsing and execution
├── repomap.ts         # Core RepoMap class (orchestrates the pipeline)
├── tags.ts            # Tree-sitter tag extraction (def/ref)
├── pagerank.ts        # PageRank algorithm implementation
├── tree-context.ts    # Smart code snippet rendering
├── file-discovery.ts  # Recursive file scanning + .gitignore
├── languages.ts       # Language detection from file extensions
├── token-counter.ts   # Token counting (gpt-tokenizer)
├── cache.ts           # Disk-based tag cache
└── utils.ts           # Shared types and utilities
queries/               # Tree-sitter SCM queries from Aider
```

## License

MIT
