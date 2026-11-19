# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Game model with a stable id, source, install path, optional executable and store ids.
- JSON library store under `%APPDATA%\ViaLink\library.json` with atomic writes and deduplication by
  source and store id.
- Manual entries take precedence over detected entries for the same install folder.
- Steam scanner reading `libraryfolders.vdf` and `appmanifest_*.acf` across every library folder.
- Epic scanner reading launcher manifests.
- Minimal VDF reader with tests.

[Unreleased]: https://github.com/Kymie131/Via_Link/commits/main
