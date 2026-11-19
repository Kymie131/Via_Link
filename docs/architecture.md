# Architecture

## Model

`Game` is the only entity. It is plain data with no behaviour, so it serialises to JSON without a
mapping layer.

| Field         | Notes                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------- |
| `id`          | 12 hex characters, derived from the source and a stable key. Never changes for a given game. |
| `title`       | Display name. A later scan may correct it.                                                   |
| `source`      | `steam`, `epic`, `gog`, `emulator` or `manual`.                                              |
| `installPath` | Absolute install folder. The join key for manual precedence.                                 |
| `executable`  | Optional launch target.                                                                      |
| `steamAppId`  | Optional, Steam only. Kept next to `storeIds.steam` for convenience.                         |
| `storeIds`    | Per-store native id. This is what deduplication uses.                                        |
| `addedAt`     | ISO timestamp of the first time the entry entered the library.                               |

The id comes from the store's own identifier when one exists, and from the normalised title and
path otherwise. That way a Steam game keeps its id when the installer moves the folder, while a
manual entry still gets a stable id without a store id.

## Interfaces

`Scanner` has `source`, `isAvailable()` and `scan()`. Availability is separate from scanning so the
CLI can report a launcher that is not installed without treating it as a failure.

`LibraryStore` has `load`, `save`, `upsert` and `remove`. `upsert` is the merge point and returns
which entries were added or updated, which is what the CLI reports.

## Deduplication and precedence

`upsert` keys entries by `source` plus the store id, falling back to source, title and normalised
path. Two entries with the same key collapse into one.

Manual precedence is a separate rule and runs first: if a manual entry already owns an install
folder, a scanned entry for that folder is dropped. Curated metadata is never overwritten by a
launcher.

On update the existing `id` and `addedAt` are preserved, so references to a game stay valid.

## Storage

One JSON file with an explicit `version` field. Writes go to a temporary sibling file and are then
renamed over the target, which is atomic on NTFS. `rename` occasionally fails while a virus scanner
holds the target; the store retries a few times before giving up.

Malformed entries inside an otherwise valid file are skipped. A file that is not valid JSON is an
error, because silently replacing it would destroy the library.

## Scanners

Steam reads its install path from `HKCU\Software\Valve\Steam`, then walks every library folder listed
in `libraryfolders.vdf`. Only numeric keys are library entries; the file also carries counters such
as `contentstatsid` that are not folders.

Epic reads the launcher manifests folder directly. Each `.item` file is a JSON document.

Both scanners tolerate a corrupt entry by skipping it rather than aborting the scan.

## VDF reader

`steamapps` files are Valve's KeyValues text format. A full library is more than this project needs,
so `src/scanners/vdf.ts` implements the subset Steam actually writes: quoted and bare tokens, nested
blocks, line comments and backslash escapes.

## Non-goals for now

Save backup, Steam shortcut creation, artwork and achievements are designed for but not implemented.
GOG and emulators have a place in the `GameSource` union so stored libraries stay forward-compatible.
