import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createGame } from '../core/game.js';
import type { Game } from '../core/types.js';

export class UsageError extends Error {}

export function formatTable(games: readonly Game[]): string {
  if (games.length === 0) return 'No games in the library. Run "vialink scan" first.';

  const columns = ['ID', 'TITLE', 'SOURCE', 'PATH'] as const;
  const rows = games.map((game) => [game.id, game.title, game.source, game.installPath]);
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...rows.map((row) => (row[index] as string).length)),
  );

  const line = (row: readonly string[]): string =>
    row
      .map((cell, index) => cell.padEnd(widths[index] as number))
      .join('  ')
      .trimEnd();

  const header = line(columns);
  return [header, '-'.repeat(header.length), ...rows.map(line)].join('\n');
}

export interface AddOptions {
  readonly title: string;
  readonly path: string;
  readonly exe?: string;
}

export function buildManualGame(
  options: AddOptions,
  exists: (path: string) => boolean = existsSync,
): Game {
  const installPath = resolve(options.path);
  if (!exists(installPath)) {
    throw new UsageError(`install path does not exist: ${installPath}`);
  }
  const executable = options.exe === undefined ? undefined : resolve(options.exe);
  return createGame({
    title: options.title,
    source: 'manual',
    installPath,
    ...(executable === undefined ? {} : { executable }),
  });
}
