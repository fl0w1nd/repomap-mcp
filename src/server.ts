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
        "Generate a repository map showing the most important code definitions, " +
        "ranked by PageRank analysis of cross-file references. " +
        "Useful for understanding codebase structure.",
      inputSchema: {
        projectRoot: z.string().describe("Absolute path to the repository root"),
        chatFiles: z
          .array(z.string())
          .optional()
          .describe("Files currently in the chat context (highest priority)"),
        otherFiles: z
          .array(z.string())
          .optional()
          .describe("Other relevant files to consider"),
        tokenLimit: z
          .number()
          .optional()
          .default(8192)
          .describe("Maximum number of tokens for the output map"),
        excludeUnranked: z
          .boolean()
          .optional()
          .default(false)
          .describe("Exclude files with zero PageRank"),
        forceRefresh: z
          .boolean()
          .optional()
          .default(false)
          .describe("Force refresh of cached tags"),
        mentionedFiles: z
          .array(z.string())
          .optional()
          .describe("Files explicitly mentioned (get a ranking boost)"),
        mentionedIdents: z
          .array(z.string())
          .optional()
          .describe("Identifiers explicitly mentioned (get a ranking boost)"),
        verbose: z.boolean().optional().default(false),
      },
    },
    async ({
      projectRoot,
      chatFiles,
      otherFiles,
      tokenLimit,
      excludeUnranked,
      forceRefresh,
      mentionedFiles,
      mentionedIdents,
      verbose,
    }) => {
      try {
        const repoMap = new RepoMap(projectRoot, { verbose });
        const result = await repoMap.getRepoMap({
          root: projectRoot,
          chatFiles,
          otherFiles,
          mapTokens: tokenLimit,
          excludeUnranked,
          forceRefresh,
          mentionedFiles,
          mentionedIdents,
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
        "Search for code identifiers (functions, classes, variables) across the repository. " +
        "Returns matching definitions and references with code context.",
      inputSchema: {
        projectRoot: z.string().describe("Absolute path to the repository root"),
        query: z.string().describe("Identifier name to search for"),
        maxResults: z
          .number()
          .optional()
          .default(50)
          .describe("Maximum number of results"),
        includeDefinitions: z
          .boolean()
          .optional()
          .default(true)
          .describe("Include definitions in results"),
        includeReferences: z
          .boolean()
          .optional()
          .default(true)
          .describe("Include references in results"),
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
