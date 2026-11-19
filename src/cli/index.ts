#!/usr/bin/env node
import { Command } from 'commander';
import { JsonLibraryStore } from '../core/store.js';
import { defaultScanners } from '../core/scanners.js';
import type { Scanner } from '../core/types.js';
import { buildManualGame, formatTable, UsageError } from './format.js';

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

export interface CliDependencies {
  readonly store: JsonLibraryStore;
  readonly scanners: Scanner[];
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
}

function defaultDependencies(): CliDependencies {
  return {
    store: new JsonLibraryStore(),
    scanners: defaultScanners(),
    log: (message) => process.stdout.write(`${message}\n`),
    error: (message) => process.stderr.write(`${message}\n`),
  };
}

export function buildProgram(overrides: Partial<CliDependencies> = {}): Command {
  const deps: CliDependencies = { ...defaultDependencies(), ...overrides };
  const program = new Command();

  program
    .name('vialink')
    .description('Detect installed games and keep the library in one place.')
    .version('0.1.0')
    .exitOverride()
    .configureOutput({ writeOut: deps.log, writeErr: deps.error });

  program
    .command('scan')
    .description('Detect games from installed launchers and merge them into the library.')
    .action(async () => {
      const found = [];
      for (const scanner of deps.scanners) {
        if (!(await scanner.isAvailable())) {
          deps.log(`skip: ${scanner.source} not detected`);
          continue;
        }
        const games = await scanner.scan();
        deps.log(`found: ${games.length} from ${scanner.source}`);
        found.push(...games);
      }

      const { added, updated } = await deps.store.upsert(found);
      deps.log(`added: ${added.length}, updated: ${updated.length}`);
      process.exitCode = EXIT_OK;
    });

  program
    .command('list')
    .description('List every game in the library.')
    .action(async () => {
      deps.log(formatTable(await deps.store.load()));
      process.exitCode = EXIT_OK;
    });

  program
    .command('add')
    .description('Add a game manually.')
    .requiredOption('--title <title>', 'display title')
    .requiredOption('--path <path>', 'install directory')
    .option('--exe <path>', 'executable to launch')
    .action(async (options: { title: string; path: string; exe?: string }) => {
      const game = buildManualGame(options);
      const { added, updated } = await deps.store.upsert([game]);
      if (added.length > 0) {
        deps.log(`added: ${game.id} ${game.title}`);
        process.exitCode = EXIT_OK;
        return;
      }
      if (updated.length > 0) {
        deps.log(`updated: ${game.id} ${game.title}`);
        process.exitCode = EXIT_OK;
        return;
      }
      deps.error(`already in the library, no changes: ${game.id}`);
      process.exitCode = EXIT_FAILURE;
    });

  program
    .command('remove')
    .description('Remove a game by id.')
    .argument('<id>', 'game id from "vialink list"')
    .action(async (id: string) => {
      const removed = await deps.store.remove(id);
      if (!removed) {
        deps.error(`no game with id: ${id}`);
        process.exitCode = EXIT_FAILURE;
        return;
      }
      deps.log(`removed: ${id}`);
      process.exitCode = EXIT_OK;
    });

  return program;
}

export async function main(argv: readonly string[] = process.argv): Promise<number> {
  const program = buildProgram();
  try {
    await program.parseAsync([...argv]);
    return typeof process.exitCode === 'number' ? process.exitCode : EXIT_OK;
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n`);
      return EXIT_USAGE;
    }
    const code = (error as { code?: unknown }).code;
    if (code === 'commander.helpDisplayed' || code === 'commander.version') {
      return EXIT_OK;
    }
    if (typeof code === 'string' && code.startsWith('commander.')) {
      return EXIT_USAGE;
    }
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_FAILURE;
  }
}
