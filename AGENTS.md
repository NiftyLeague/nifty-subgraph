## Stack

| Layer | Tech |
|---|---|
| Framework | `@graphprotocol/graph-cli` **0.98.1**, `@graphprotocol/graph-ts` **0.38.2** |
| Language | AssemblyScript (Wasm target) — `assemblyscript` **0.19.23** |
| Schema | GraphQL (The Graph schema.graphql) |
| Deploy target | **The Graph Studio** — subgraph name `nifty-league-sepolia` |
| Node engine | `24.x` |
| Package manager | **bun** `1.3.14` (specified in `packageManager` — do NOT use npm/pnpm/yarn) |
| Linting | `eslint` + `typescript-eslint` |
| Formatting | `prettier` |
| Testing | `matchstick-as` **0.6.0** (The Graph's WASM unit-test framework) |
| CI | GitHub Actions (branches: `main`, `staging`) |

## Commands

| Script | Command | Purpose |
|---|---|---|
| `codegen` | `graph codegen` | Generate AssemblyScript types from `schema.graphql` + ABIs into `generated/` |
| `build` | `graph build` | Compile subgraph to WebAssembly into `build/` |
| `deploy` | `graph deploy --node https://api.studio.thegraph.com/deploy/ nifty-league-sepolia` | Deploy to The Graph Studio |
| `create-local` | `graph create --node http://localhost:8020/ nifty-league-sepolia` | Register subgraph on local graph-node |
| `remove-local` | `graph remove --node http://localhost:8020/ nifty-league-sepolia` | Remove subgraph from local graph-node |
| `deploy-local` | `graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 nifty-league-sepolia` | Deploy to local dev graph-node |
| `test` | `graph test --version 0.6.0` | Run matchstick-as unit tests |
| `test:coverage` | `node scripts/check-coverage.mjs` | Check test line coverage |
| `format` | `prettier --write .` | Auto-format all sources |
| `format:check` | `prettier --check .` | Verify formatting in CI |
| `lint` | `eslint . --max-warnings=0` | Lint all sources (zero-warning policy) |

**CI pipeline** (`.github/workflows/ci.yml`): `bun install --frozen-lockfile` → `bun run format:check` → `bun run lint` → `bunx graph codegen` → `bun run build` → `bun run test` → `bun run test:coverage` → `bun pm audit --audit-level=high`

## Entry Points

| Path | Role |
|---|---|
| `schema.graphql` | Subgraph schema — defines all entities and their relationships |
| `subgraph.yaml` | Manifest — data source config, contract address, event handlers, ABIs |
| `src/nifty-degen.ts` | **Primary mapping file** — all 7 event handlers, delegates `NameUpdated` & `Transfer` to `custom-mappings.ts` |
| `src/custom-mappings.ts` | **Business logic** — creates/updates `Contract`, `Owner`, `Character`, `TraitMap` entities; manages character name history |
| `src/backgrounds.ts` | Background-tier classifier — maps token IDs to background types (Legendary=3, Meta=2, Rare=1, Common=0) |
| `src/constants.ts` | Hardcoded arrays of `LEGGIES`, `METAS`, and `RARES` token IDs |
| `tests/nifty-degen.test.ts` | Matchstick unit tests covering all 7 event handlers |
| `tests/nifty-degen-utils.ts` | Test helpers — event factory functions |
| `abis/NiftyDegen.json` | Contract ABI for the NiftyDegen contract |
| `scripts/check-coverage.mjs` | Coverage threshold enforcer for tests |

## Conventions / Gotchas

- **Forbidden dirs — never commit**: `generated/` (codegen output), `build/` (compiled subgraph), `coverage/` (test coverage), `node_modules/`. Already listed in ESLint's `ignores` and `.gitignore`.
- **Package manager is bun only**: `packageManager` field enforces `bun@1.3.14`. Install with `bun install --frozen-lockfile` (CI does this). Using npm/pnpm/yarn will break lockfile integrity.
- **Deploy target is The Graph Studio**: `nifty-league-sepolia` — not hosted-service, not a custom graph-node. Use `bun run deploy` to push.
- **Local dev requires a running graph-node**: Start one locally first, then `bun run create-local` (once) and `bun run deploy-local` (each deploy). The Graph CLI docs cover running a local graph-node via Docker.
- **Codegen before build**: `bun run codegen` must be run before `bun run build` — it populates the `generated/` directory that the TypeScript/AssemblyScript sources import from.
- **Matchstick test version is pinned**: Tests require `matchstick-as 0.6.0` and the `--version 0.6.0` flag in the test command. Do not bump matchstick-as without also updating the test command.
- **Contract is mainnet NiftyDegen**: Address `0x986aea67c7d6a15036e18678065eb663fc5be883`, start block `13274505`. The subgraph indexes a single ERC-721 contract (NiftyDegen).
- **Background tiers are hardcoded**: `src/constants.ts` contains three explicit arrays of token IDs (LEGGIES, METAS, RARES). These are used in `src/backgrounds.ts` to assign the `background` trait (0=Common, 1=Rare, 2=Meta, 3=Legendary). Any new token ID not in these lists defaults to Common.
- **Event-to-entity mapping**: Each on-chain event maps 1:1 to an immutable event entity except `NameUpdated` and `Transfer`, which also trigger `custom-mappings.ts` to update domain entities (`Character`, `Owner`, `Contract`, `TraitMap`).
- **Lint zero-warnings policy**: `eslint . --max-warnings=0` will fail if even a single warning is present. Keep the codebase clean.
