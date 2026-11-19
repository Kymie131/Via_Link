import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { join } from 'node:path';
import { createGame } from '../core/game.js';
import type { Game, Scanner } from '../core/types.js';
import { asObject, asString, parseVdf } from './vdf.js';

export interface SteamScannerOptions {
  readonly steamRoot?: string;
  readonly registryReader?: () => Promise<string | null>;
}

export function readSteamPathFromRegistry(): Promise<string | null> {
  return new Promise((resolve) => {
    exec(
      'reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath',
      { windowsHide: true },
      (error, stdout) => {
        if (error !== null) {
          resolve(null);
          return;
        }
        const match = /SteamPath\s+REG_SZ\s+(.+)/.exec(stdout);
        const raw = match?.[1]?.trim();
        resolve(raw === undefined || raw.length === 0 ? null : raw.replace(/\//g, '\\'));
      },
    );
  });
}

export async function readLibraryFolders(steamRoot: string): Promise<string[]> {
  const file = join(steamRoot, 'steamapps', 'libraryfolders.vdf');
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [steamRoot];
    throw error;
  }
  const parsed = parseVdf(raw);
  const folders = asObject(parsed.libraryfolders);
  if (folders === undefined) return [steamRoot];

  const paths: string[] = [];
  for (const [key, value] of Object.entries(folders)) {
    if (!/^\d+$/.test(key)) continue;
    const entry = asObject(value);
    const path = entry === undefined ? undefined : asString(entry.path);
    if (path !== undefined && path.length > 0 && !paths.includes(path)) {
      paths.push(path);
    }
  }
  return paths.length > 0 ? paths : [steamRoot];
}

export interface SteamManifestGame {
  readonly appId: number;
  readonly name: string;
  readonly installDir: string;
}

export function parseAppManifest(raw: string): SteamManifestGame | null {
  const parsed = parseVdf(raw);
  const state = asObject(parsed.AppState);
  if (state === undefined) return null;

  const appIdText = asString(state.appid);
  const name = asString(state.name);
  const installDir = asString(state.installdir);
  if (appIdText === undefined || name === undefined || installDir === undefined) return null;

  if (!/^\d+$/.test(appIdText)) return null;
  const appId = Number.parseInt(appIdText, 10);
  if (!Number.isSafeInteger(appId)) return null;

  return { appId, name, installDir };
}

export class SteamScanner implements Scanner {
  readonly source = 'steam' as const;

  constructor(private readonly options: SteamScannerOptions = {}) {}

  private async resolveRoot(): Promise<string | null> {
    if (this.options.steamRoot !== undefined) return this.options.steamRoot;
    const fromRegistry = await (this.options.registryReader ?? readSteamPathFromRegistry)();
    if (fromRegistry !== null) return fromRegistry;
    return null;
  }

  async isAvailable(): Promise<boolean> {
    const root = await this.resolveRoot();
    if (root === null) return false;
    return existsSync(join(root, 'steamapps'));
  }

  async scan(): Promise<Game[]> {
    const root = await this.resolveRoot();
    if (root === null) return [];

    const libraries = await readLibraryFolders(root);
    const games: Game[] = [];

    for (const library of libraries) {
      const steamapps = join(library, 'steamapps');
      let entries: string[];
      try {
        entries = await readdir(steamapps);
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.startsWith('appmanifest_') || !entry.endsWith('.acf')) continue;
        let manifest: SteamManifestGame | null;
        try {
          manifest = parseAppManifest(await readFile(join(steamapps, entry), 'utf8'));
        } catch {
          continue;
        }
        if (manifest === null) continue;

        games.push(
          createGame({
            title: manifest.name,
            source: 'steam',
            installPath: join(steamapps, 'common', manifest.installDir),
            steamAppId: manifest.appId,
          }),
        );
      }
    }

    return games;
  }
}
