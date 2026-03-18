#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { parseArgs, runCli } from "./cli.js";

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

  const parsed = parseArgs(args);

  if (parsed.serve) {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);

    process.on("SIGINT", async () => {
      await server.close();
      process.exit(0);
    });
  } else {
    await runCli(args);
  }
}

function printHelp(): void {
  process.stderr.write(`repomap-mcp - Repository map generator with MCP server support

Usage:
  repomap-mcp [paths...] [options]    Generate a repo map (CLI mode)
  repomap-mcp --serve                 Start MCP stdio server

Options:
  --root <dir>              Repository root directory (default: ".")
  --map-tokens <n>          Maximum tokens for the map (default: 8192)
  --chat-files <files...>   Files in current chat context (highest priority)
  --other-files <files...>  Other relevant files
  --mentioned-files <f...>  Explicitly mentioned files (ranking boost)
  --mentioned-idents <i...> Explicitly mentioned identifiers (ranking boost)
  --verbose                 Enable verbose output
  --force-refresh           Force refresh of cached tags
  --exclude-unranked        Exclude files with zero PageRank
  --serve                   Start as MCP stdio server
  --help, -h                Show this help message
  --version, -v             Show version number
`);
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error}\n`);
  process.exit(1);
});
