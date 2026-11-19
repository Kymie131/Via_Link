# Architecture

## Model

`Game` is the only entity. It is plain data with no behaviour, so it serialises to JSON without a
mapping layer.

| Field         | Notes                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | 12 hex characters, derived from the source and a stable key. Stable across folder and title changes when the source provides a store id. |
| `title`       | Display name. A later scan may correct it.                                                                                               |
| `source`      | `steam`, `epic`, `gog`, `emulator` or `manual`.                                                                                          |
| `installPath` | Absolute install folder. The join key for manual precedence.                                                                             |
| `executable`  | Optional launch target.                                                                                                                  |
| `steamAppId`  | Optional, Steam only. Kept next to `storeIds.steam` for convenience.                                                                     |
| `storeIds`    | Per-store native id. This is what deduplication uses.                                                                                    |
| `addedAt`     | ISO timestamp of the first time the entry entered the library.                                                                           |

Note the fallback: an entry without a store id derives its id from the title and path, so renaming
such an entry produces a new identity. Store-backed entries keep theirs across relocation and
renames.

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

Malformed entries inside an otherwise valid file are skipped: an unknown `source`, a `storeIds`
member that is not a string, or a wrongly typed optional field. A file that is not valid JSON, or
whose `version` this build does not know, is an error, because silently rewriting it would destroy
the library.

## Scanners

Steam reads its install path from `HKCU\Software\Valve\Steam`, then walks every library folder listed
in `libraryfolders.vdf`. Only numeric keys are library entries; the file also carries counters such
as `contentstatsid` that are not folders.

Epic reads the launcher manifests folder directly. Each `.item` file is a JSON document. A manifest
whose `AppCategories` exist but do not include `games` is skipped, so DLC and launcher components do
not enter the library.

Both scanners tolerate a corrupt entry by skipping it rather than aborting the scan. Steam app ids
must be purely numeric; a value such as `400junk` is rejected rather than parsed to `400`.

## VDF reader

`steamapps` files are Valve's KeyValues text format. A full library is more than this project needs,
so `src/scanners/vdf.ts` implements the subset Steam actually writes: quoted and bare tokens, nested
blocks, line comments and backslash escapes.

## Non-goals for now

Save backup, Steam shortcut creation, artwork and achievements are designed for but not implemented.
GOG and emulators have a place in the `GameSource` union so stored libraries stay forward-compatible.
