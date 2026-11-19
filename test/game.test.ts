import { describe, expect, it } from 'vitest';
import { createGame, makeGameId } from '../src/core/game.js';

describe('createGame', () => {
  const fixed = new Date('2026-01-01T00:00:00.000Z');

  it('produces a stable id for the same identity', () => {
    const a = createGame(
      { title: 'Portal', source: 'steam', installPath: 'D:/G/P', steamAppId: 400 },
      fixed,
    );
    const b = createGame(
      { title: 'Portal', source: 'steam', installPath: 'D:/G/P', steamAppId: 400 },
      fixed,
    );
    expect(a.id).toBe(b.id);
  });

  it('records the steam app id in both fields', () => {
    const game = createGame(
      { title: 'Portal', source: 'steam', installPath: 'D:/G/P', steamAppId: 400 },
      fixed,
    );
    expect(game.steamAppId).toBe(400);
    expect(game.storeIds.steam).toBe('400');
  });

  it('omits optional fields rather than setting undefined', () => {
    const game = createGame({ title: 'Manual', source: 'manual', installPath: 'D:/G/M' }, fixed);
    expect('executable' in game).toBe(false);
    expect('steamAppId' in game).toBe(false);
  });

  it('keeps an explicit executable', () => {
    const game = createGame(
      { title: 'Manual', source: 'manual', installPath: 'D:/G/M', executable: 'D:/G/M/run.exe' },
      fixed,
    );
    expect(game.executable).toBe('D:/G/M/run.exe');
  });

  it('stamps addedAt from the supplied clock', () => {
    const game = createGame({ title: 'M', source: 'manual', installPath: 'D:/G/M' }, fixed);
    expect(game.addedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('gives different sources different ids', () => {
    const steam = createGame(
      { title: 'X', source: 'steam', installPath: 'D:/G/X', steamAppId: 9 },
      fixed,
    );
    const epic = createGame(
      {
        title: 'X',
        source: 'epic',
        installPath: 'D:/G/X',
        storeIds: { epic: '9' },
      },
      fixed,
    );
    expect(steam.id).not.toBe(epic.id);
  });

  it('produces a 12 character id', () => {
    expect(makeGameId('steam', '400')).toMatch(/^[0-9a-f]{12}$/);
  });
});
