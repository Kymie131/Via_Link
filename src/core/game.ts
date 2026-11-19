import { createHash } from 'node:crypto';
import type { Game, GameSource, StoreIds } from './types.js';

export interface NewGame {
  readonly title: string;
  readonly source: GameSource;
  readonly installPath: string;
  readonly executable?: string;
  readonly steamAppId?: number;
  readonly storeIds?: StoreIds;
}

export function makeGameId(source: GameSource, key: string): string {
  return createHash('sha1').update(`${source}:${key}`).digest('hex').slice(0, 12);
}

export function gameKey(game: Pick<Game, 'source' | 'storeIds' | 'title' | 'installPath'>): string {
  const { steam, epic, gog } = game.storeIds;
  const storeId = steam ?? epic ?? gog;
  if (storeId !== undefined) return `${game.source}:${storeId}`;
  const path = normalizePath(game.installPath);
  return `${game.source}:${game.title.toLowerCase()}:${path}`;
}

export function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export function createGame(input: NewGame, now: Date = new Date()): Game {
  const storeIds: StoreIds = {
    ...(input.storeIds ?? {}),
    ...(input.steamAppId === undefined ? {} : { steam: String(input.steamAppId) }),
  };

  return {
    id: makeGameId(input.source, gameKey({ ...input, storeIds })),
    title: input.title,
    source: input.source,
    installPath: input.installPath,
    storeIds,
    addedAt: now.toISOString(),
    ...(input.executable === undefined ? {} : { executable: input.executable }),
    ...(input.steamAppId === undefined ? {} : { steamAppId: input.steamAppId }),
  };
}
