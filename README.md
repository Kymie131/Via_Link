# Via Link

Detect installed games, keep their saves backed up in a private Git repository, and add them to
Steam with proper artwork.

Via Link is a Windows-first command line tool. It reads the manifests that Steam and Epic already
write to disk, builds one library file you can trust, and gives you a single place to curate it
before those games become Steam shortcuts.

## Why

Ports, emulated titles and store games scatter themselves across folders and launchers. Backing up
their saves is manual, and adding them to Steam means editing shortcuts by hand. Via Link reads
what the launchers already know, so you do not have to retype it.

## Scope of version 0.1

- Detect Steam games from `libraryfolders.vdf` and `appmanifest_*.acf`.
- Detect Epic games from the launcher manifests.
- Store the library in a single JSON file with atomic writes.
- Add, list and remove manual entries from the CLI.

Not in this version: save backup, Steam shortcuts, artwork, local achievements, GOG, emulators. The
`GameSource` union and the `Scanner` and `LibraryStore` interfaces leave room for them, but no code
for those features exists yet.

## Requirements

- Windows 10 or later
- Node.js 20 or later
- pnpm 9 or later

## Install

```powershell
pnpm install
pnpm build
```

Run it straight from the build output:

```powershell
node dist/cli/bin.js --help
```

Or link the binary so `vialink` is on your path:

```powershell
pnpm link --global
```

## Usage

```text
vialink scan                              # detect games from installed launchers
vialink list                              # show the library
vialink add --title "Game" --path "D:\Games\Game"
vialink add --title "Game" --path "D:\Games\Game" --exe "D:\Games\Game\game.exe"
vialink remove <id>                       # remove by the id shown in list
```

`--path` must be an existing directory; `add` refuses a path that is not there. `--exe` is optional.

`scan` merges what it finds into the library. Entries you added by hand always win over a detected
entry that points at the same folder, whichever one was stored first.

Exit codes: `0` success, `1` the requested change could not be made, `2` the arguments were wrong.

## Where the library lives

`%APPDATA%\ViaLink\library.json`

The file is written to a temporary sibling and renamed into place, so an interrupted write never
leaves a half-written library behind.

## Development

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm format
```

The test suite uses synthetic fixtures only. It never reads a real Steam or Epic installation.

## Layout

```text
src/
  cli/        command line entry points and output formatting
  core/       Game model, JSON library store, scanner registry
  scanners/   Steam, Epic and the small VDF reader they share
test/         vitest suites and inline fixtures
docs/         architecture notes
```

## Roadmap

- GOG support through its registry keys and local database.
- Emulator library support, starting with the common portable layouts.
- Incremental save backup to a private Git repository, with a per-game manifest and a diff-friendly
  layout.
- Steam shortcuts with cover, logo, icon, publisher and release year.
- Local achievements for ports and emulated titles.

## License

MIT. See [LICENSE](LICENSE).
