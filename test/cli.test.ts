import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../src/core/game.js';
import { JsonLibraryStore } from '../src/core/store.js';
import type { Scanner } from '../src/core/types.js';
import { buildProgram } from '../src/cli/index.js';

let directory: string;
let store: JsonLibraryStore;
let output: string[];
let errors: string[];

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vialink-cli-'));
  store = new JsonLibraryStore({ filePath: join(directory, 'library.json') });
  output = [];
  errors = [];
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function fakeScanner(source: 'steam' | 'epic', games: ReturnType<typeof createGame>[]): Scanner {
  return {
    source,
    isAvailable: () => Promise.resolve(true),
    scan: () => Promise.resolve(games),
  };
}

async function run(argv: string[], scanners: Scanner[] = []) {
  const program = buildProgram({
    store,
    scanners,
    log: (message) => output.push(message),
    error: (message) => errors.push(message),
  });
  program.exitOverride();
  await program.parseAsync(['node', 'vialink', ...argv]);
}

describe('vialink CLI', () => {
  it('adds a manual game and lists it', async () => {
    await run(['add', '--title', 'Sample', '--path', directory]);
    await run(['list']);
    expect(output.join('\n')).toContain('Sample');
    expect(await store.load()).toHaveLength(1);
  });

  it('reports a duplicate manual add as an error', async () => {
    await run(['add', '--title', 'Sample', '--path', directory]);
    await run(['add', '--title', 'Sample', '--path', directory]);
    expect(errors.join('\n')).toContain('already in the library');
    expect(await store.load()).toHaveLength(1);
  });

  it('merges scanner results during scan', async () => {
    const game = createGame({
      title: 'Scanned',
      source: 'steam',
      installPath: join(directory, 'game'),
      steamAppId: 1,
    });
    await run(['scan'], [fakeScanner('steam', [game])]);
    expect(output.join('\n')).toContain('added: 1');
    expect(await store.load()).toHaveLength(1);
  });

  it('skips scanners that are not available', async () => {
    const unavailable: Scanner = {
      source: 'epic',
      isAvailable: () => Promise.resolve(false),
      scan: () => Promise.reject(new Error('should not be called')),
    };
    await run(['scan'], [unavailable]);
    expect(output.join('\n')).toContain('skip: epic');
  });

  it('removes a game by id', async () => {
    await run(['add', '--title', 'Sample', '--path', directory]);
    const [game] = await store.load();
    expect(game).toBeDefined();
    await run(['remove', (game as { id: string }).id]);
    expect(await store.load()).toEqual([]);
  });

  it('reports a miss when removing an unknown id', async () => {
    await run(['remove', 'nope']);
    expect(errors.join('\n')).toContain('no game with id');
  });

  it('prints a hint when the library is empty', async () => {
    await run(['list']);
    expect(output.join('\n')).toContain('No games in the library');
  });
});
