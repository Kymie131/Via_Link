import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readLibraryFolders, SteamScanner } from '../src/scanners/steam.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vialink-steam-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writeManifest(library: string, appId: number, name: string, dir: string) {
  const steamapps = join(library, 'steamapps');
  await mkdir(steamapps, { recursive: true });
  await writeFile(
    join(steamapps, `appmanifest_${appId}.acf`),
    `"AppState"\n{\n\t"appid"\t\t"${appId}"\n\t"name"\t\t"${name}"\n\t"installdir"\t\t"${dir}"\n}\n`,
    'utf8',
  );
}

describe('readLibraryFolders', () => {
  it('reads every numeric library entry', async () => {
    await mkdir(join(root, 'steamapps'), { recursive: true });
    await writeFile(
      join(root, 'steamapps', 'libraryfolders.vdf'),
      `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"C:\\\\Steam"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"D:\\\\SteamLibrary"\n\t}\n}\n`,
      'utf8',
    );
    expect(await readLibraryFolders(root)).toEqual(['C:\\Steam', 'D:\\SteamLibrary']);
  });

  it('ignores non-numeric keys such as contentstatsid', async () => {
    await mkdir(join(root, 'steamapps'), { recursive: true });
    await writeFile(
      join(root, 'steamapps', 'libraryfolders.vdf'),
      `"libraryfolders"\n{\n\t"contentstatsid"\t\t"123"\n\t"0"\n\t{\n\t\t"path"\t\t"C:\\\\Steam"\n\t}\n}\n`,
      'utf8',
    );
    expect(await readLibraryFolders(root)).toEqual(['C:\\Steam']);
  });

  it('falls back to the steam root when the file is empty of entries', async () => {
    await mkdir(join(root, 'steamapps'), { recursive: true });
    await writeFile(join(root, 'steamapps', 'libraryfolders.vdf'), '"libraryfolders" { }', 'utf8');
    expect(await readLibraryFolders(root)).toEqual([root]);
  });
});

describe('SteamScanner', () => {
  it('reports unavailable when no steam root exists', async () => {
    const scanner = new SteamScanner({ registryReader: () => Promise.resolve(null) });
    expect(await scanner.isAvailable()).toBe(false);
    expect(await scanner.scan()).toEqual([]);
  });

  it('scans manifests across libraries', async () => {
    const second = join(root, 'second');
    await mkdir(join(root, 'steamapps'), { recursive: true });
    await writeFile(
      join(root, 'steamapps', 'libraryfolders.vdf'),
      `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${root.replace(/\\/g, '\\\\')}"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"${second.replace(/\\/g, '\\\\')}"\n\t}\n}\n`,
      'utf8',
    );
    await writeManifest(root, 400, 'Portal', 'Portal');
    await writeManifest(second, 620, 'Portal 2', 'Portal 2');

    const games = await new SteamScanner({ steamRoot: root }).scan();
    const titles = games.map((game) => game.title).sort();
    expect(titles).toEqual(['Portal', 'Portal 2']);
    expect(games.every((game) => game.source === 'steam')).toBe(true);
  });

  it('skips files that are not manifests', async () => {
    await mkdir(join(root, 'steamapps'), { recursive: true });
    await writeFile(join(root, 'steamapps', 'notes.txt'), 'ignored', 'utf8');
    const games = await new SteamScanner({ steamRoot: root }).scan();
    expect(games).toEqual([]);
  });

  it('continues past a corrupt manifest', async () => {
    await mkdir(join(root, 'steamapps'), { recursive: true });
    await writeFile(join(root, 'steamapps', 'appmanifest_1.acf'), '"AppState" { broken', 'utf8');
    await writeManifest(root, 2, 'Good', 'Good');
    const games = await new SteamScanner({ steamRoot: root }).scan();
    expect(games.map((game) => game.title)).toEqual(['Good']);
  });

  it('builds install paths under steamapps/common', async () => {
    await writeManifest(root, 400, 'Portal', 'Portal');
    const [game] = await new SteamScanner({ steamRoot: root }).scan();
    expect(game?.installPath.endsWith(join('steamapps', 'common', 'Portal'))).toBe(true);
    expect(game?.steamAppId).toBe(400);
  });
});
