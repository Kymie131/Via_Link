export type GameSource = 'steam' | 'epic' | 'gog' | 'emulator' | 'manual';

export interface StoreIds {
  readonly steam?: string;
  readonly epic?: string;
  readonly gog?: string;
}

export interface Game {
  readonly id: string;
  readonly title: string;
  readonly source: GameSource;
  readonly installPath: string;
  readonly executable?: string;
  readonly steamAppId?: number;
  readonly storeIds: StoreIds;
  readonly addedAt: string;
}

export interface Scanner {
  readonly source: GameSource;
  isAvailable(): Promise<boolean>;
  scan(): Promise<Game[]>;
}

export interface LibraryStore {
  load(): Promise<Game[]>;
  save(games: readonly Game[]): Promise<void>;
  upsert(games: readonly Game[]): Promise<{ added: Game[]; updated: Game[] }>;
  remove(id: string): Promise<boolean>;
}
