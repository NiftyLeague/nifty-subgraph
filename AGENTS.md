## Stack

The Graph subgraph for the Nifty League `NiftyDegen` ERC-721 (Ethereum mainnet).

- **Subgraph framework**: `@graphprotocol/graph-cli` 0.98.1, `@graphprotocol/graph-ts` 0.38.2
- **Mapping language**: AssemblyScript (Wasm target) — `assemblyscript` 0.19.23. `src/*.ts` is **not** Node TypeScript; it is compiled to WASM by `graph build`. AssemblyScript intrinsics (`i32`, `BigInt`, `Bytes`, `Address`, `store`, `log`) only resolve under `@graphprotocol/graph-ts` types.
- **Schema**: GraphQL SDL in `schema.graphql`; codegen emits AssemblyScript entity/event types into `generated/`.
- **Manifests**: Dual network support — `subgraph.yaml` (root = mainnet), `configs/subgraph.mainnet.yaml`, `configs/subgraph.sepolia.yaml` (specVersion 1.3.0, ethereum/events, apiVersion 0.0.9).
- **Deploy targets**: The Graph Studio — both networks use slug `nifty-league-sepolia`. Local: `graph-node` on `http://localhost:8020`, IPFS on `http://localhost:5001`.
- **Indexed contracts**: `NiftyDegen` mainnet at `0x986aea67c7d6a15036e18678065eb663fc5be883` (start block 13274505), Sepolia at `0x6adFF2BB4A465A885425e3bd4304A78BB659B12e` (start block 5541380).
- **Node**: `24.x` (pinned to `24.18.0` via `mise.toml`).
- **Package manager**: `bun@1.3.14` (`packageManager` field; enforced). Do not use npm/pnpm/yarn.
- **Toolchain pinning**: `mise.toml` pins `node = "24.18.0"` and `bun = "1.3.14"`. CI uses `jdx/mise-action` to install these exact versions.
- **Lint/format**: `eslint` 10.7.0 + `typescript-eslint` 8.64.0, `prettier` 3.6.2. Zero-warning policy (`--max-warnings=0`).
- **Test runner**: Bun's built-in `bun:test` (NOT vitest, NOT jest, NOT matchstick).
- **Hooks**: `husky` + `lint-staged` (pre-commit runs prettier + eslint --fix on staged files).

## Commands

All commands run from repo root via `bun run <script>`. Lockfile is `bun.lock`; never `npm install`/`pnpm install`.

| Script                                                             | Command                                                                                                          | Purpose                                                                                                                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `install`                                                          | `bun install --frozen-lockfile`                                                                                  | Install deps against pinned `bun.lock` (what CI uses).                                                                                                         |
| `codegen`                                                          | `graph codegen`                                                                                                  | Generate AssemblyScript types (default = mainnet).                                                                                                             |
| `codegen:mainnet`                                                  | `graph codegen configs/subgraph.mainnet.yaml`                                                                    | Generate types from mainnet manifest.                                                                                                                          |
| `codegen:sepolia`                                                  | `graph codegen configs/subgraph.sepolia.yaml`                                                                    | Generate types from sepolia manifest.                                                                                                                          |
| `build`                                                            | `graph build`                                                                                                    | Compile mainnet subgraph to WASM into `build/`.                                                                                                                |
| `build:mainnet`                                                    | `graph build configs/subgraph.mainnet.yaml`                                                                      | Compile mainnet subgraph from manifest in `configs/`.                                                                                                          |
| `build:sepolia`                                                    | `graph build configs/subgraph.sepolia.yaml`                                                                      | Compile sepolia subgraph from manifest in `configs/`.                                                                                                          |
| `test`                                                             | `bun test bun-tests`                                                                                             | Run Bun's native test runner over the `bun-tests/` directory. Imports from `bun:test` (`describe`/`it`/`expect`).                                              |
| `type:check`                                                       | `tsc --noEmit`                                                                                                   | TypeScript type-check (editor/CI sanity). Uses `tsconfig.json` which extends `@graphprotocol/graph-ts/types/tsconfig.base.json` and sets `skipLibCheck: true`. |
| `lint`                                                             | `eslint . --max-warnings=0`                                                                                      | Lint everything; fails on any warning.                                                                                                                         |
| `format`                                                           | `prettier --write .`                                                                                             | Auto-format.                                                                                                                                                   |
| `format:check`                                                     | `prettier --check .`                                                                                             | CI formatting gate.                                                                                                                                            |
| `deploy`                                                           | `graph deploy --node https://api.studio.thegraph.com/deploy/ nifty-league-sepolia`                               | Deploy mainnet subgraph to The Graph Studio.                                                                                                                   |
| `deploy:mainnet`                                                   | `graph deploy --node https://api.studio.thegraph.com/deploy/ nifty-league-sepolia configs/subgraph.mainnet.yaml` | Deploy mainnet from manifest in `configs/`.                                                                                                                    |
| `deploy:sepolia`                                                   | `graph deploy --node https://api.studio.thegraph.com/deploy/ nifty-league-sepolia configs/subgraph.sepolia.yaml` | Deploy sepolia from manifest in `configs/`.                                                                                                                    |
| `create-local` / `remove-local` / `deploy-local` / `dev` / `start` | (see `package.json`)                                                                                             | Local graph-node flow on `localhost:8020` + IPFS `5001`.                                                                                                       |

CI order (`.github/workflows/ci.yml`): `bun install --frozen-lockfile` → `bun run format:check` → `bun run lint` → `bunx graph codegen` → `bun run build` → `bun run build:sepolia` → `bun run test` → coverage gate.

## Structure

```
.
├── subgraph.yaml              # Root manifest (mainnet, backward-compatible default)
├── configs/
│   ├── subgraph.mainnet.yaml  # Mainnet manifest (network=mainnet, address=0x986..., startBlock=13274505)
│   └── subgraph.sepolia.yaml  # Sepolia manifest (network=sepolia, address=0x6ad..., startBlock=5541380)
├── schema.graphql             # Entity definitions (Contract, Owner, Character, TraitMap, + 7 event entities)
├── networks.json             # Network deployment metadata
├── package.json              # scripts + packageManager=bun@1.3.14
├── bun.lock                  # Bun lockfile (commit; install with --frozen-lockfile)
├── mise.toml                 # node 24.18.0 + bun 1.3.14 pins
├── tsconfig.json             # extends graph-ts base; skipLibCheck; excludes tests/, bun-tests/, node_modules
├── eslint.config.mjs         # Flat config; ignores generated/, build/, coverage/, node_modules/
├── .prettierrc / .prettierignore
├── lint-staged.config.js     # prettier + eslint --fix on staged {ts,tsx,js,json,md,yml,yaml,sol}
├── .husky/pre-commit         # Runs lint-staged. NEVER bypass with --no-verify.
├── abis/
│   └── NiftyDegen.json       # Contract ABI referenced by subgraph.yaml
├── generated/                # gitignored; produced by `graph codegen`
├── build/                    # gitignored; produced by `graph build` (WASM)
├── src/
│   ├── nifty-degen.ts        # Entry mapping — all 7 event handlers declared in subgraph.yaml
│   ├── custom-mappings.ts    # Domain entity logic (Contract, Owner, Character, TraitMap); called by NameUpdated + Transfer
│   ├── backgrounds.ts        # AssemblyScript background-tier classifier (0..3)
│   ├── background-classifier.ts  # Pure JS mirror of backgrounds.ts — keeps bun-testable surface
│   └── constants.ts          # Hardcoded LEGGIES / METAS / RARES token-id arrays
├── bun-tests/                # ONLY directory Bun's `bun test` runs
│   └── background-classifier.test.ts
├── tests/                    # LEGACY matchstick-style fixtures (nifty-degen.test.ts, nifty-degen-utils.ts). Not run by `bun test`; excluded from tsconfig.
├── scripts/
│   └── check-coverage.mjs    # Coverage threshold enforcer (test:coverage)
└── .github/workflows/
    ├── ci.yml                # Main CI (uses jdx/mise-action)
    └── dependency-review.yml
```

## Conventions & Gotchas

- **This is a subgraph, not a Node app.** `src/*.ts` is AssemblyScript compiled to WASM by `graph build`. There is no `tsc` build step. Do not add Node APIs, `fs`, `path`, dynamic `require`, or top-level await in `src/`. If logic needs to be unit-tested under Bun, mirror it as plain JS in a separate file (see `background-classifier.ts` vs `backgrounds.ts`).
- **`tsc --noEmit` is best-effort sanity, not a build.** It will produce bogus arity / param-count errors against the generated AssemblyScript types. The author is using TS 5.4.5 with `skipLibCheck: true` to keep `type:check` signal-to-noise high. If a TS upgrade changes `baseUrl` semantics, re-pin. (Do not rely on `tsc` to validate subgraph correctness — only `graph build` does.)
- **Bun-only, lockfile-pinned.** `packageManager: "bun@1.3.14"`. CI uses `bun install --frozen-lockfile`. Local dev matches because `mise.toml` pins the same `bun` version. Mixing npm/pnpm/yarn will desync `bun.lock` and break CI.
- **No `graph test`, no matchstick.** Despite `matchstick-as` appearing in `devDependencies` and a `test:graph` script in `package.json`, the canonical test command is `bun test bun-tests`. Do not add a `graph test` step to CI; do not migrate `bun-tests/` to matchstick. The `tests/` directory is legacy fixtures only.
- **Codegen before build, every time.** `graph build` reads `generated/`. After editing `schema.graphql`, `subgraph.yaml`, or `abis/*.json`, re-run `bun run codegen` before `bun run build` or `bun run type:check`. CI order enforces this; locally it's your job.
- **Generated/types are gitignored but referenced.** `src/*.ts` imports from `../generated/NiftyDegen/NiftyDegen` and `../generated/schema`. If you see "cannot find module `../generated/...`", you skipped codegen.
- **Event handlers are 1:1 with `subgraph.yaml`.** All seven handlers in `src/nifty-degen.ts` (`handleApproval`, `handleApprovalForAll`, `handleNameUpdated`, `handleOwnershipTransferred`, `handlePaused`, `handleTransfer`, `handleUnpaused`) must match the `eventHandlers:` block. Adding a new event means: edit ABI → edit `subgraph.yaml` → run codegen → add handler → add to schema.
- **Domain logic is delegated.** `NameUpdated` and `Transfer` handlers call into `src/custom-mappings.ts` to mutate `Contract` / `Owner` / `Character` / `TraitMap`. The other five events only write their own immutable event entity. Don't move that split.
- **Background tiers are hardcoded token IDs.** `src/constants.ts` lists `LEGGIES`, `METAS`, `RARES`. `backgrounds.ts` (AssemblyScript) and `background-classifier.ts` (Bun-testable) must stay in sync — both default to `Common`/`0` for unlisted IDs. The Bun test asserts the three arrays are sorted, deduplicated, and disjoint; keep them that way.
- **TypeScript is pinned intentionally.** The TS 5.4.5 pin exists because newer TS removed/changed `baseUrl` handling that `graph-ts` types rely on. Do not bump TypeScript without re-running `bun run type:check` and `bun run build` and confirming `generated/` types still resolve.
- **Lint is zero-warning.** `eslint . --max-warnings=0`. Even one warning fails CI and the pre-commit hook. Treat warnings as errors.
- **Pre-commit hook is mandatory.** `husky` + `lint-staged` runs `prettier --write` then `eslint --fix --max-warnings=0` on staged files. Never `git commit --no-verify`. If the hook is "broken", fix the staged file — don't bypass it.
- **Deploy target is The Graph Studio, not Hosted Service.** Slug is `nifty-league-sepolia` for both mainnet and sepolia deployments. Use `bun run deploy` (mainnet) or `bun run deploy:sepolia`; for local graph-node use `create-local` (once) then `deploy-local`.
- **Dual-network manifests live in `configs/`.** The root `subgraph.yaml` is mainnet (backward-compatible default). Each manifest targets a different network with its own contract address and startBlock. The `src/` code is identical — only network metadata differs. CI builds both manifests.
- **`nifty-league-subgraph-dev` has been archived.** The Sepolia dev twin repo is now archived on GitHub. All development (mainnet + sepolia) happens in this repo. Use `bun run build:sepolia` / `bun run deploy:sepolia` for Sepolia workflows.
- **Forbidden in git**: `generated/`, `build/`, `coverage/`, `node_modules/`, `dist/`. Already in `.gitignore` and ESLint's `ignores`. Do not commit them; do not lint them.
