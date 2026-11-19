import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Game, GameSource } from './types.js';
import { gameKey, normalizePath } from './game.js';

interface LibraryFile {
  readonly version: 1;
  readonly games: Game[];
}

const CURRENT_VERSION = 1;
const SOURCES: readonly GameSource[] = ['steam', 'epic', 'gog', 'emulator', 'manual'];

export function defaultLibraryPath(env: NodeJS.ProcessEnv = process.env): string {
  const appData = env.APPDATA;
  if (appData !== undefined && appData.length > 0) {
    return join(appData, 'ViaLink', 'library.json');
  }
  const home = env.HOME ?? env.USERPROFILE ?? '.';
  return join(home, '.vialink', 'library.json');
}

function isSource(value: unknown): value is GameSource {
  return typeof value === 'string' && (SOURCES as readonly string[]).includes(value);
}

function isStoreIds(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === 'string');
}

function isGame(value: unknown): value is Game {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.installPath !== 'string' ||
    typeof candidate.addedAt !== 'string' ||
    !isSource(candidate.source) ||
    !isStoreIds(candidate.storeIds)
  ) {
    return false;
  }
  if (candidate.executable !== undefined && typeof candidate.executable !== 'string') return false;
  return candidate.steamAppId === undefined || typeof candidate.steamAppId === 'number';
}

function parseLibrary(raw: string): LibraryFile {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('library file is not a JSON object');
  }
  const candidate = parsed as Record<string, unknown>;
  if (!Array.isArray(candidate.games)) {
    throw new Error('library file is missing a games array');
  }
  if (candidate.version !== CURRENT_VERSION) {
    throw new Error(
      `unsupported library version ${String(candidate.version)}; this build reads version ${CURRENT_VERSION}`,
    );
  }
  return { version: CURRENT_VERSION, games: candidate.games.filter(isGame) };
}

function sameContent(a: Game, b: Game): boolean {
  return (
    a.title === b.title &&
    a.installPath === b.installPath &&
    a.executable === b.executable &&
    a.steamAppId === b.steamAppId &&
    a.storeIds.steam === b.storeIds.steam &&
    a.storeIds.epic === b.storeIds.epic &&
    a.storeIds.gog === b.storeIds.gog
  );
}

export interface JsonLibraryStoreOptions {
  readonly filePath?: string;
}

export class JsonLibraryStore {
  readonly filePath: string;

  constructor(options: JsonLibraryStoreOptions = {}) {
    this.filePath = options.filePath ?? defaultLibraryPath();
  }

  async load(): Promise<Game[]> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
    return parseLibrary(raw).games;
  }

  async save(games: readonly Game[]): Promise<void> {
    const payload: LibraryFile = { version: CURRENT_VERSION, games: [...games] };
    const directory = dirname(this.filePath);
    await mkdir(directory, { recursive: true });

    const temporary = `${this.filePath}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await rename(temporary, this.filePath);
          return;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') throw error;
          await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        }
      }
      throw new Error(`could not replace ${this.filePath}`);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }

  async upsert(games: readonly Game[]): Promise<{ added: Game[]; updated: Game[] }> {
    const existing = await this.load();
    const byKey = new Map<string, Game>(existing.map((game) => [gameKey(game), game]));

    // Manual precedence is computed up front from both the stored library and
    // the incoming batch, so the result does not depend on iteration order.
    const manualPaths = new Set<string>();
    for (const game of [...existing, ...games]) {
      if (game.source === 'manual') manualPaths.add(normalizePath(game.installPath));
    }

    const added: Game[] = [];
    const updated: Game[] = [];

    for (const incoming of games) {
      if (incoming.source !== 'manual' && manualPaths.has(normalizePath(incoming.installPath))) {
        continue;
      }
      const key = gameKey(incoming);
      const current = byKey.get(key);
      if (current === undefined) {
        byKey.set(key, incoming);
        added.push(incoming);
        continue;
      }
      if (current.source === 'manual' && incoming.source !== 'manual') {
        continue;
      }
      const merged: Game = { ...incoming, id: current.id, addedAt: current.addedAt };
      if (sameContent(current, merged)) {
        continue;
      }
      byKey.set(key, merged);
      updated.push(merged);
    }

    if (added.length > 0 || updated.length > 0) {
      await this.save([...byKey.values()]);
    }
    return { added, updated };
  }

  async remove(id: string): Promise<boolean> {
    const existing = await this.load();
    const remaining = existing.filter((game) => game.id !== id);
    if (remaining.length === existing.length) {
      return false;
    }
    await this.save(remaining);
    return true;
  }
}
