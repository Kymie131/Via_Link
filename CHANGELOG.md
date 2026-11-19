# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-18

### Added

- Game model with a stable id, source, install path, optional executable and store ids.
- JSON library store under `%APPDATA%\ViaLink\library.json` with atomic writes and deduplication by
  source and store id.
- Manual entries take precedence over detected entries for the same install folder, independently of
  which one was stored first.
- Steam scanner reading `libraryfolders.vdf` and `appmanifest_*.acf` across every library folder.
- Epic scanner reading launcher manifests, limited to entries categorised as games.
- Minimal VDF reader with tests.
- `vialink` commands: `scan` (detect and merge), `list`, `add` (manual entry, optional executable)
  and `remove`.
- TypeScript build, linting, formatting and test toolchain.

[Unreleased]: https://github.com/Kymie131/Via_Link/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Kymie131/Via_Link/commits/main
