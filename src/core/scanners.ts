import type { Scanner } from './types.js';
import { SteamScanner } from '../scanners/steam.js';
import { EpicScanner } from '../scanners/epic.js';

export function defaultScanners(): Scanner[] {
  return [new SteamScanner(), new EpicScanner()];
}
