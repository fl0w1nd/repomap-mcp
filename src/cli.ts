import path from "node:path";
import { RepoMap } from "./repomap.js";

interface CliArgs {
  paths: string[];
  root: string;
  mapTokens: number;
  focusFiles: string[];
  additionalFiles: string[];
  priorityFiles: string[];
  priorityIdents: string[];
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
    focusFiles: [],
    additionalFiles: [],
    priorityFiles: [],
    priorityIdents: [],
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
      case "--focus-files":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.focusFiles.push(argv[++i]);
        }
        break;
      case "--additional-files":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.additionalFiles.push(argv[++i]);
        }
        break;
      case "--priority-files":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.priorityFiles.push(argv[++i]);
        }
        break;
      case "--priority-idents":
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          args.priorityIdents.push(argv[++i]);
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

  const additionalFiles = args.additionalFiles.length > 0 ? args.additionalFiles : args.paths;

  const result = await repoMap.getRepoMap({
    root,
    focusFiles: args.focusFiles,
    additionalFiles,
    priorityFiles: args.priorityFiles,
    priorityIdentifiers: args.priorityIdents,
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
