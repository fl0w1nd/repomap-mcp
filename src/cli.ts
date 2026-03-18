import path from "node:path";
import { RepoMap } from "./repomap.js";

interface CliArgs {
  paths: string[];
  root: string;
  mapTokens: number;
  chatFiles: string[];
  otherFiles: string[];
  mentionedFiles: string[];
  mentionedIdents: string[];
  verbose: boolean;
  forceRefresh: boolean;
  excludeUnranked: boolean;
  serve: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    paths: [],
    root: ".",
    mapTokens: 8192,
    chatFiles: [],
    otherFiles: [],
    mentionedFiles: [],
    mentionedIdents: [],
    verbose: false,
    forceRefresh: false,
    excludeUnranked: false,
    serve: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case "--root":
        args.root = argv[++i] ?? ".";
        break;
      case "--map-tokens":
        args.mapTokens = parseInt(argv[++i] ?? "8192", 10);
        break;
      case "--chat-files":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.chatFiles.push(argv[++i]);
        }
        break;
      case "--other-files":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.otherFiles.push(argv[++i]);
        }
        break;
      case "--mentioned-files":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.mentionedFiles.push(argv[++i]);
        }
        break;
      case "--mentioned-idents":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.mentionedIdents.push(argv[++i]);
        }
        break;
      case "--verbose":
        args.verbose = true;
        break;
      case "--force-refresh":
        args.forceRefresh = true;
        break;
      case "--exclude-unranked":
        args.excludeUnranked = true;
        break;
      case "--serve":
        args.serve = true;
        break;
      default:
        if (!arg.startsWith("--")) {
          args.paths.push(arg);
        }
        break;
    }
    i++;
  }

  return args;
}

export async function runCli(argv: string[]): Promise<void> {
  const args = parseArgs(argv);

  if (args.serve) return;

  const root = path.resolve(args.root);
  const repoMap = new RepoMap(root, {
    mapTokens: args.mapTokens,
    verbose: args.verbose,
  });

  const otherFiles = args.otherFiles.length > 0 ? args.otherFiles : args.paths;

  const result = await repoMap.getRepoMap({
    root,
    chatFiles: args.chatFiles,
    otherFiles,
    mentionedFiles: args.mentionedFiles,
    mentionedIdents: args.mentionedIdents,
    forceRefresh: args.forceRefresh,
    excludeUnranked: args.excludeUnranked,
    mapTokens: args.mapTokens,
  });

  process.stdout.write(result.map);

  if (args.verbose) {
    process.stderr.write(
      `\n--- Report ---\n` +
      `Files considered: ${result.report.totalFilesConsidered}\n` +
      `Definitions found: ${result.report.definitionMatches}\n` +
      `References found: ${result.report.referenceMatches}\n`,
    );
  }
}
