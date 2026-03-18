import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RepoMap } from "./repomap.js";

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "repomap-mcp", version: "0.1.0" },
    { capabilities: { logging: {} } },
  );

  server.registerTool(
    "repo_map",
    {
      title: "Generate Repo Map",
      description:
        "Generate a ranked repository map of code definitions " +
        "via PageRank over cross-file reference graphs. " +
        "Useful for understanding codebase structure, discovering entry points, " +
        "or finding code related to specific files or identifiers.",
      inputSchema: {
        projectRoot: z.string().describe("Absolute path to the repository root"),
        focusFiles: z
          .array(z.string())
          .optional()
          .describe(
            "Already-known files used as ranking anchor (x20 boost). " +
            "Related code ranks higher; these files are excluded from output.",
          ),
        additionalFiles: z
          .array(z.string())
          .optional()
          .describe("Extra file paths to include in analysis beyond auto-discovered ones."),
        tokenLimit: z
          .number()
          .optional()
          .default(8192)
          .describe("Maximum token count for the output map"),
        excludeUnranked: z
          .boolean()
          .optional()
          .default(false)
          .describe("Exclude files with zero PageRank from output"),
        forceRefresh: z
          .boolean()
          .optional()
          .default(false)
          .describe("Bypass tag cache and re-parse all files"),
        priorityFiles: z
          .array(z.string())
          .optional()
          .describe(
            "Important files that receive a ranking boost (x5). " +
            "Still included in output, unlike focusFiles.",
          ),
        priorityIdentifiers: z
          .array(z.string())
          .optional()
          .describe(
            "Identifier names to boost in ranking (x10). " +
            "Matches definitions across all files.",
          ),
        verbose: z.boolean().optional().default(false),
      },
    },
    async ({
      projectRoot,
      focusFiles,
      additionalFiles,
      tokenLimit,
      excludeUnranked,
      forceRefresh,
      priorityFiles,
      priorityIdentifiers,
      verbose,
    }) => {
      try {
        const repoMap = new RepoMap(projectRoot, { verbose });
        const result = await repoMap.getRepoMap({
          root: projectRoot,
          focusFiles,
          additionalFiles,
          mapTokens: tokenLimit,
          excludeUnranked,
          forceRefresh,
          priorityFiles,
          priorityIdentifiers,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error generating repo map: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "search_identifiers",
    {
      title: "Search Identifiers",
      description:
        "Search for code identifiers (functions, classes, variables) across the repository " +
        "via Tree-sitter AST analysis. Returns matching definitions and references with code context.",
      inputSchema: {
        projectRoot: z.string().describe("Absolute path to the repository root"),
        query: z.string().describe("Identifier name to search for (case-insensitive substring match)"),
        maxResults: z
          .number()
          .optional()
          .default(50)
          .describe("Maximum number of results"),
        includeDefinitions: z
          .boolean()
          .optional()
          .default(true)
          .describe("Include definition sites"),
        includeReferences: z
          .boolean()
          .optional()
          .default(true)
          .describe("Include reference sites"),
      },
    },
    async ({ projectRoot, query, maxResults, includeDefinitions, includeReferences }) => {
      try {
        const repoMap = new RepoMap(projectRoot);
        const results = await repoMap.searchIdentifiers(query, {
          maxResults,
          includeDefinitions,
          includeReferences,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ results }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching identifiers: ${(err as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}
