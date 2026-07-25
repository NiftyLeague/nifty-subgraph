# Nifty League Subgraph

Subgraph indexing [NiftyDegen](https://niftyleague.com) NFTs across **mainnet** and **sepolia** — powering the NiftyLeague ecosystem on The Graph Network.

## Overview

This subgraph indexes `NiftyDegen` ERC-721 contract events (Transfer, Approval, NameUpdated, Paused, etc.) and serves the data to NiftyLeague frontends via GraphQL. The same mapping code compiles for both mainnet and sepolia — only the contract address and start block differ per network.

## Architecture

```
├── configs/
│   ├── subgraph.mainnet.yaml    # Mainnet manifest (network=mainnet, 0x986..., block 13274505)
│   └── subgraph.sepolia.yaml    # Sepolia manifest (network=sepolia, 0x6ad..., block 5541380)
├── schema.graphql               # Entity definitions
├── src/                         # AssemblyScript mappings (shared)
├── bun-tests/                   # Unit tests
└── subgraph.yaml                # Root manifest = mainnet (backward-compatible default)
```

- **Dual manifest** — one manifest per network in `configs/`. The root `subgraph.yaml` is a copy of the mainnet config for backward compatibility.
- **Shared code** — `src/*.ts` mapping code is identical for both networks. Only network metadata differs.
- **Single slug** — both deployments share the same Graph Studio slug `nifty-league-sepolia`.

## Prerequisites

- [bun](https://bun.sh) ^1.3 (via [mise](https://mise.jdx.dev) — `.mise.toml` pins the version)
- [Node.js](https://nodejs.org) ^24.18
- [graph-cli](https://thegraph.com/docs/en/developing/creating-a-subgraph/) (`bun add --global @graphprotocol/graph-cli`)

## Quick Start

```bash
# Install dependencies
bun install

# Generate AssemblyScript types (from schema + ABIs)
bun run codegen

# Build for mainnet
bun run build

# Build for sepolia
bun run build:sepolia

# Run unit tests
bun run test
```

## Build Commands

| Command                                    | Target                                  |
| ------------------------------------------ | --------------------------------------- |
| `bun run codegen`                          | Generate types (same for both networks) |
| `bun run build` or `bun run build:mainnet` | Build mainnet manifest → `build/`       |
| `bun run build:sepolia`                    | Build sepolia manifest → `build/`       |
| `bun run format`                           | Format all source files                 |
| `bun run lint`                             | ESLint zero-warning check               |
| `bun run type:check`                       | TypeScript type checking                |

## Deployment

All deployments go to The Graph Studio.

```bash
# Deploy mainnet
bun run deploy

# Deploy sepolia
bun run deploy:sepolia
```

For local development with a graph-node:

```bash
# Once: create local subgraph
bun run create-local

# After each change: deploy locally
bun run deploy-local
```

## Testing

```bash
# All unit tests
bun run test

# With coverage
bun run coverage
```

Tests are in `bun-tests/` and use `bun:test`. Legacy matchstick tests are in `tests/`.

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):

1. **Quality** — format check, lint, type check, build (both manifests)
2. **Test** — run all unit tests (depends on Quality)
3. **Security** — osv-scanner against `bun.lock` with allowlist for known-unfixable transitive vulns

Security gate uses `scripts/audit.sh` which only fails on **new** (un-allowlisted) vulnerabilities — preventing CI from breaking on upstream CVE patches that can't be remediated.

## Project Status

Consolidated from `nifty-league-subgraph` + archived `nifty-league-subgraph-dev`. All development (mainnet + sepolia) now lives in this single repo.

## License

Proprietary — NiftyLeague. All rights reserved.
