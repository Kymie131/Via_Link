import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../src/core/game.js';
import { JsonLibraryStore } from '../src/core/store.js';
import type { Scanner } from '../src/core/types.js';
import { buildProgram } from '../src/cli/index.js';
import { UsageError } from '../src/cli/format.js';

let directory: string;
let store: JsonLibraryStore;
let output: string[];
let errors: string[];

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'vialink-cli-'));
  store = new JsonLibraryStore({ filePath: join(directory, 'library.json') });
  output = [];
  errors = [];
  process.exitCode = undefined;
});

afterEach(async () => {
  process.exitCode = undefined;
  await rm(directory, { recursive: true, force: true });
});

function fakeScanner(source: 'steam' | 'epic', games: ReturnType<typeof createGame>[]): Scanner {
  return {
    source,
    isAvailable: () => Promise.resolve(true),
    scan: () => Promise.resolve(games),
  };
}

async function run(argv: string[], scanners: Scanner[] = []): Promise<number | undefined> {
  const program = buildProgram({
    store,
    scanners,
    log: (message) => output.push(message),
    error: (message) => errors.push(message),
  });
  program.exitOverride();
  await program.parseAsync(['node', 'vialink', ...argv]);
  const code = process.exitCode;
  return typeof code === 'number' ? code : undefined;
}

describe('vialink CLI', () => {
  it('adds a manual game and lists it', async () => {
    const exit = await run(['add', '--title', 'Sample', '--path', directory]);
    await run(['list']);
    expect(exit).toBe(0);
    expect(output.join('\n')).toContain('Sample');
    expect(await store.load()).toHaveLength(1);
  });

  it('fails when the same manual entry is added twice with no change', async () => {
    await run(['add', '--title', 'Sample', '--path', directory]);
    const exit = await run(['add', '--title', 'Sample', '--path', directory]);
    expect(exit).toBe(1);
    expect(errors.join('\n')).toContain('no changes');
    expect(await store.load()).toHaveLength(1);
  });

  it('updates a manual entry when only the executable is added', async () => {
    await run(['add', '--title', 'Sample', '--path', directory]);
    const exit = await run([
      'add',
      '--title',
      'Sample',
      '--path',
      directory,
      '--exe',
      join(directory, 'run.exe'),
    ]);
    expect(exit).toBe(0);
    expect(output.join('\n')).toContain('updated:');
    const [game] = await store.load();
    expect(game?.executable).toContain('run.exe');
  });

  it('rejects an install path that does not exist', async () => {
    await expect(
      run(['add', '--title', 'Ghost', '--path', join(directory, 'missing')]),
    ).rejects.toBeInstanceOf(UsageError);
    expect(await store.load()).toEqual([]);
  });

  it('merges scanner results during scan', async () => {
    const game = createGame({
      title: 'Scanned',
      source: 'steam',
      installPath: join(directory, 'game'),
      steamAppId: 1,
    });
    const exit = await run(['scan'], [fakeScanner('steam', [game])]);
    expect(exit).toBe(0);
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
    const exit = await run(['remove', (game as { id: string }).id]);
    expect(exit).toBe(0);
    expect(await store.load()).toEqual([]);
  });

  it('reports a miss when removing an unknown id', async () => {
    const exit = await run(['remove', 'nope']);
    expect(exit).toBe(1);
    expect(errors.join('\n')).toContain('no game with id');
  });

  it('prints a hint when the library is empty', async () => {
    const exit = await run(['list']);
    expect(exit).toBe(0);
    expect(output.join('\n')).toContain('No games in the library');
  });

  it('fails when a required option is missing', async () => {
    await expect(run(['add', '--title', 'NoPath'])).rejects.toThrow();
    expect(await store.load()).toEqual([]);
  });
});
