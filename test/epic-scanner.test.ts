import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EpicScanner } from '../src/scanners/epic.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vialink-epic-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function item(appName: string, displayName: string, installLocation: string, exe?: string) {
  return JSON.stringify({
    AppName: appName,
    DisplayName: displayName,
    InstallLocation: installLocation,
    ...(exe === undefined ? {} : { LaunchExecutable: exe }),
  });
}

describe('EpicScanner', () => {
  it('reports unavailable when the manifests folder is missing', async () => {
    const scanner = new EpicScanner({ manifestsPath: join(root, 'nope') });
    expect(await scanner.isAvailable()).toBe(false);
    expect(await scanner.scan()).toEqual([]);
  });

  it('scans .item manifests', async () => {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'first.item'), item('aaa', 'First Game', 'D:/Games/First'), 'utf8');
    await writeFile(
      join(root, 'second.item'),
      item('bbb', 'Second Game', 'D:/Games/Second'),
      'utf8',
    );

    const games = await new EpicScanner({ manifestsPath: root }).scan();
    expect(games.map((game) => game.title).sort()).toEqual(['First Game', 'Second Game']);
    expect(games.every((game) => game.source === 'epic')).toBe(true);
  });

  it('ignores files without the .item extension', async () => {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'notes.txt'), item('ccc', 'Nope', 'D:/G/N'), 'utf8');
    expect(await new EpicScanner({ manifestsPath: root }).scan()).toEqual([]);
  });

  it('skips a corrupt manifest and keeps the rest', async () => {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'broken.item'), '{ nope', 'utf8');
    await writeFile(join(root, 'good.item'), item('ddd', 'Good', 'D:/Games/Good'), 'utf8');
    const games = await new EpicScanner({ manifestsPath: root }).scan();
    expect(games.map((game) => game.title)).toEqual(['Good']);
  });

  it('records the epic app name as a store id', async () => {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, 'one.item'), item('xyz', 'Game', 'D:/Games/Game'), 'utf8');
    const [game] = await new EpicScanner({ manifestsPath: root }).scan();
    expect(game?.storeIds.epic).toBe('xyz');
  });
});
