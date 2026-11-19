import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createGame } from '../core/game.js';
import type { Game, Scanner } from '../core/types.js';

export interface EpicScannerOptions {
  readonly manifestsPath?: string;
}

export function defaultEpicManifestsPath(env: NodeJS.ProcessEnv = process.env): string | null {
  const programData = env.ProgramData ?? env.PROGRAMDATA;
  if (programData === undefined || programData.length === 0) return null;
  return join(programData, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
}

export interface EpicManifestGame {
  readonly appName: string;
  readonly displayName: string;
  readonly installLocation: string;
  readonly launchExecutable?: string;
}

function pickString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isGameCategory(record: Record<string, unknown>): boolean {
  const categories = record.AppCategories;
  if (categories === undefined) return true;
  if (!Array.isArray(categories)) return false;
  return categories.some((entry) => typeof entry === 'string' && entry.toLowerCase() === 'games');
}

export function parseEpicManifest(raw: string): EpicManifestGame | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  if (!isGameCategory(record)) return null;

  const appName = pickString(record, 'AppName');
  const displayName = pickString(record, 'DisplayName');
  const installLocation = pickString(record, 'InstallLocation');
  const launchExecutable = pickString(record, 'LaunchExecutable');

  if (appName === undefined || displayName === undefined || installLocation === undefined) {
    return null;
  }

  return {
    appName,
    displayName,
    installLocation,
    ...(launchExecutable === undefined ? {} : { launchExecutable }),
  };
}

export function toGame(manifest: EpicManifestGame): Game {
  if (manifest.launchExecutable === undefined) {
    return createGame({
      title: manifest.displayName,
      source: 'epic',
      installPath: manifest.installLocation,
      storeIds: { epic: manifest.appName },
    });
  }
  return createGame({
    title: manifest.displayName,
    source: 'epic',
    installPath: manifest.installLocation,
    executable: join(manifest.installLocation, manifest.launchExecutable),
    storeIds: { epic: manifest.appName },
  });
}

export class EpicScanner implements Scanner {
  readonly source = 'epic' as const;

  constructor(private readonly options: EpicScannerOptions = {}) {}

  private resolveManifestsPath(): string | null {
    return this.options.manifestsPath ?? defaultEpicManifestsPath();
  }

  isAvailable(): Promise<boolean> {
    const path = this.resolveManifestsPath();
    return Promise.resolve(path !== null && existsSync(path));
  }

  async scan(): Promise<Game[]> {
    const manifestsPath = this.resolveManifestsPath();
    if (manifestsPath === null) return [];

    let entries: string[];
    try {
      entries = await readdir(manifestsPath);
    } catch {
      return [];
    }

    const games: Game[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.item')) continue;
      let raw: string;
      try {
        raw = await readFile(join(manifestsPath, entry), 'utf8');
      } catch {
        continue;
      }
      const manifest = parseEpicManifest(raw);
      if (manifest === null) continue;
      games.push(toGame(manifest));
    }
    return games;
  }
}
