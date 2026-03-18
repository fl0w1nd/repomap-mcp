#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { parseArgs, runCli } from "./cli.js";

function shouldServe(args: string[]): boolean {
  if (args.includes("--serve")) return true;
  if (args.includes("--help") || args.includes("-h")) return false;
  if (args.includes("--version") || args.includes("-v")) return false;
  // Non-TTY stdin means we're launched by an MCP client (Inspector, Claude Desktop, etc.)
  return !process.stdin.isTTY;
}

async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  let closing = false;

  async function shutdown(): Promise<void> {
    if (closing) return;
    closing = true;
    try {
      await server.close();
    } catch {
      // best-effort
    }
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.stdin.on("close", shutdown);

  await server.connect(transport);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    process.stderr.write("repomap-mcp v0.1.0\n");
    process.exit(0);
  }

  if (shouldServe(args)) {
    await startServer();
  } else {
    await runCli(args);
  }
}

function printHelp(): void {
  process.stderr.write(`repomap-mcp - Repository map generator with MCP server support

Usage:
  repomap-mcp [paths...] [options]    Generate a repo map (CLI mode)
  repomap-mcp --serve                 Start MCP stdio server
  repomap-mcp                         Auto-detect: MCP if stdin is piped, help if TTY

Options:
  --root <dir>                Repository root directory (default: ".")
  --map-tokens <n>            Maximum tokens for the map (default: 8192)
  --focus-files <files...>    Files already known; used as ranking anchor, excluded from output
  --additional-files <f...>   Extra files to include in analysis
  --priority-files <f...>     Important files to boost in ranking (x5)
  --priority-idents <i...>    Important identifiers to boost in ranking (x10)
  --verbose                   Enable verbose output
  --force-refresh             Force refresh of cached tags
  --exclude-unranked          Exclude files with zero PageRank
  --serve                     Force MCP stdio server mode
  --help, -h                  Show this help message
  --version, -v               Show version number
`);
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error}\n`);
  process.exit(1);
});
