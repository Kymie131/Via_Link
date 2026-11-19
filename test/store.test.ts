import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGame, gameKey } from '../src/core/game.js';
import { defaultLibraryPath, JsonLibraryStore } from '../src/core/store.js';

let directory: string;
let filePath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vialink-store-'));
  filePath = join(directory, 'library.json');
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function steamGame(title: string, appId: number, path = `D:/Games/${title}`) {
  return createGame({ title, source: 'steam', installPath: path, steamAppId: appId });
}

describe('JsonLibraryStore', () => {
  it('returns an empty list when the file does not exist', async () => {
    expect(await new JsonLibraryStore({ filePath }).load()).toEqual([]);
  });

  it('round-trips games through disk', async () => {
    const store = new JsonLibraryStore({ filePath });
    const game = steamGame('Sample', 100);
    await store.save([game]);
    expect(await store.load()).toEqual([game]);
  });

  it('writes valid JSON with a version field', async () => {
    const store = new JsonLibraryStore({ filePath });
    await store.save([steamGame('Sample', 100)]);
    const raw = JSON.parse(await readFile(filePath, 'utf8')) as { version: number };
    expect(raw.version).toBe(1);
  });

  it('adds new games and reports them', async () => {
    const store = new JsonLibraryStore({ filePath });
    const { added, updated } = await store.upsert([steamGame('One', 1), steamGame('Two', 2)]);
    expect(added).toHaveLength(2);
    expect(updated).toHaveLength(0);
  });

  it('dedupes by source and store id', async () => {
    const store = new JsonLibraryStore({ filePath });
    await store.upsert([steamGame('One', 1)]);
    const { added, updated } = await store.upsert([steamGame('One Renamed', 1)]);
    expect(added).toHaveLength(0);
    expect(updated).toHaveLength(1);
    const games = await store.load();
    expect(games).toHaveLength(1);
    expect(games[0]?.title).toBe('One Renamed');
  });

  it('preserves id and addedAt on update', async () => {
    const store = new JsonLibraryStore({ filePath });
    const original = steamGame('One', 1);
    await store.upsert([original]);
    await store.upsert([steamGame('One Renamed', 1)]);
    const [stored] = await store.load();
    expect(stored?.id).toBe(original.id);
    expect(stored?.addedAt).toBe(original.addedAt);
  });

  it('lets a manual entry win over a scanner result at the same path', async () => {
    const store = new JsonLibraryStore({ filePath });
    const manual = createGame({
      title: 'Curated Title',
      source: 'manual',
      installPath: 'D:/Games/Shared',
    });
    await store.upsert([manual]);

    const scanned = steamGame('Scanned Title', 55, 'D:\\Games\\Shared');
    const { added } = await store.upsert([scanned]);

    expect(added).toHaveLength(0);
    const games = await store.load();
    expect(games.map((game) => game.title)).toEqual(['Curated Title']);
  });

  it('removes a game by id', async () => {
    const store = new JsonLibraryStore({ filePath });
    const game = steamGame('One', 1);
    await store.upsert([game]);
    expect(await store.remove(game.id)).toBe(true);
    expect(await store.load()).toEqual([]);
  });

  it('reports a miss when removing an unknown id', async () => {
    const store = new JsonLibraryStore({ filePath });
    expect(await store.remove('doesnotexist')).toBe(false);
  });

  it('skips malformed entries instead of failing the load', async () => {
    await writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        games: [
          { id: 'a' },
          { id: 'b', title: 't', source: 'steam', installPath: 'x', addedAt: 'now', storeIds: {} },
        ],
      }),
      'utf8',
    );
    const games = await new JsonLibraryStore({ filePath }).load();
    expect(games).toHaveLength(1);
    expect(games[0]?.id).toBe('b');
  });

  it('throws on malformed JSON', async () => {
    await writeFile(filePath, '{ broken', 'utf8');
    await expect(new JsonLibraryStore({ filePath }).load()).rejects.toThrow();
  });

  it('leaves no temporary files behind', async () => {
    const store = new JsonLibraryStore({ filePath });
    await store.save([steamGame('One', 1)]);
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(directory);
    expect(entries).toEqual(['library.json']);
  });
});

describe('gameKey', () => {
  it('uses the store id when present', () => {
    expect(gameKey(steamGame('One', 42))).toBe('steam:42');
  });

  it('falls back to a normalized path', () => {
    const manual = createGame({ title: 'Manual', source: 'manual', installPath: 'D:/Games/Man/' });
    expect(gameKey(manual)).toBe('manual:manual:d:/games/man');
  });
});

describe('defaultLibraryPath', () => {
  it('uses APPDATA when available', () => {
    const path = defaultLibraryPath({
      APPDATA: join('C:', 'Users', 'example', 'AppData', 'Roaming'),
    });
    expect(path).toBe(
      join('C:', 'Users', 'example', 'AppData', 'Roaming', 'ViaLink', 'library.json'),
    );
  });

  it('falls back to the home directory', () => {
    const path = defaultLibraryPath({ HOME: join('home', 'example') });
    expect(path).toBe(join('home', 'example', '.vialink', 'library.json'));
  });
});
