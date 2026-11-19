import { describe, expect, it } from 'vitest';
import { parseEpicManifest, toGame } from '../src/scanners/epic.js';
import type { EpicManifestGame } from '../src/scanners/epic.js';

const item = JSON.stringify({
  DisplayName: 'Sample Quest',
  InstallLocation: 'D:/Games/SampleQuest',
  LaunchExecutable: 'SampleQuest/Binaries/Win64/Quest.exe',
  AppName: '0000aaaabbbbccccddddeeeeffff0000',
  AppCategories: ['games'],
  FormatVersion: 0,
});

describe('parseEpicManifest', () => {
  it('maps launcher manifest fields', () => {
    expect(parseEpicManifest(item)).toEqual({
      appName: '0000aaaabbbbccccddddeeeeffff0000',
      displayName: 'Sample Quest',
      installLocation: 'D:/Games/SampleQuest',
      launchExecutable: 'SampleQuest/Binaries/Win64/Quest.exe',
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parseEpicManifest('{ not json')).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(parseEpicManifest(JSON.stringify({ AppName: 'x' }))).toBeNull();
  });

  it('returns null when a field is an empty string', () => {
    const blank = JSON.stringify({ AppName: 'x', DisplayName: '', InstallLocation: 'D:/G' });
    expect(parseEpicManifest(blank)).toBeNull();
  });

  it('returns null for manifests that are not games', () => {
    const dlc = JSON.stringify({
      AppName: 'dlc',
      DisplayName: 'Some DLC',
      InstallLocation: 'D:/G/Dlc',
      AppCategories: ['addons'],
    });
    expect(parseEpicManifest(dlc)).toBeNull();
  });

  it('accepts a manifest whose categories include games', () => {
    const withGames = JSON.stringify({
      AppName: 'x',
      DisplayName: 'Game',
      InstallLocation: 'D:/G/G',
      AppCategories: ['addons', 'games'],
    });
    expect(parseEpicManifest(withGames)?.displayName).toBe('Game');
  });
});

describe('toGame', () => {
  it('builds an epic game with a store id', () => {
    const manifest = parseEpicManifest(item);
    expect(manifest).not.toBeNull();
    const game = toGame(manifest as EpicManifestGame);
    expect(game.source).toBe('epic');
    expect(game.storeIds.epic).toBe('0000aaaabbbbccccddddeeeeffff0000');
    expect(game.title).toBe('Sample Quest');
    expect(game.executable).toContain('Quest.exe');
  });

  it('omits the executable when the manifest has none', () => {
    const game = toGame({
      appName: 'abc',
      displayName: 'Headless',
      installLocation: 'D:/Games/Headless',
    });
    expect(game.executable).toBeUndefined();
  });
});
