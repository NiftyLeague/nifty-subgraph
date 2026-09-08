# Performance baseline and regression gates

This document records milestone M0's reproducible local and live production baseline. It separates deterministic build and mapping budgets from network-sensitive deployment checks so CI can catch code regressions without treating Internet variance as a code failure.

## Baseline

Captured on 2026-09-07 (America/Puerto_Rico) from `codex/m0-performance-audit` at its M0 working tree, using Bun 1.4.0, Node 24.18.0, macOS 25.6 arm64, and an Apple M2 Max with 12 logical CPUs and 64 GiB RAM.

| Area               | Fixture                                      |            Baseline |                 Budget |
| ------------------ | -------------------------------------------- | ------------------: | ---------------------: |
| Graph codegen      | Root mainnet manifest                        |              769 ms |            <= 5,000 ms |
| Graph build        | Mainnet                                      |            2,076 ms |           <= 10,000 ms |
| Graph build        | Sepolia                                      |            2,082 ms |           <= 10,000 ms |
| Mapping runtime    | 1,000,000 background classifications         |         29.5M ops/s |          >= 3.0M ops/s |
| Indexing behavior  | 1,000 unique `Approval` events in Matchstick |      3,553 events/s |      >= 2,000 events/s |
| Matchstick runtime | Full integration suite and fixture           |            2,345 ms |           <= 15,000 ms |
| Build output       | Mapping WASM, each network                   |        62,420 bytes |       <= 100,000 bytes |
| Dependency cost    | Installed dependency tree                    | 1,625,153,536 bytes | <= 2,147,483,648 bytes |
| Dependency cost    | Resolved tree entries                        |                 535 |                 <= 700 |

Mainnet and Sepolia produced byte-identical mapping WASM (`f8045f1b77ae578a7fd96fe9d3b11c777931cfd7a2402c94b8401d28a9252cc2`), as expected because the manifests differ only in network metadata.

The 1,000-event fixture exercises actual generated entities, event IDs, and store writes in Matchstick. It is a regression proxy, not a graph-node replay: provider RPC, Firehose, PostgreSQL, chain reorgs, and Graph Network infrastructure are outside that number.

## Mapping and schema behavior

- Every event writes its immutable event entity. `Transfer` then updates contract, owner, character, and sometimes trait state.
- A new character transfer performs contract calls for total supply, removed traits, character traits, and name. Existing-character transfers still refresh total supply and removed traits.
- `Character.owner` is the query-driving relation; `Owner.characters` is correctly derived and avoids maintaining a growing ID array.
- Immutable event and trait entities are already declared immutable, allowing graph-node to use its immutable-entity path.
- `indexerHints.prune: auto` is enabled in both manifests.

The implemented safe improvement replaces linear scans of the three sorted rarity tables with binary search and converts the token ID once. The same-machine pure classification fixture improved from 6.63M operations/s (151 ms per million) to 29.5M operations/s (34 ms per million), about 4.5x, with exhaustive equivalence coverage for every collection ID from 0 through 10,000. The compiled WASM also decreased from 62,527 to 62,420 bytes.

Potential follow-ups were deliberately not mixed into M0:

- Demote per-transfer and per-name `info` logs only after confirming the operational logging requirement; this is likely to reduce indexing I/O but changes observability.
- Avoid refreshing `totalSupply` and `removedTraits` on every transfer only after proving exact invalidation semantics from contract events. Caching without that proof can make indexed state stale.
- Benchmark a graph-node replay against a pinned provider and database snapshot before changing entity layout or handler call patterns. Matchstick cannot predict database or provider bottlenecks.

## Budgets and fixtures

Budgets live in `performance/budgets.json`; representative live queries live in `performance/queries.json`. Run:

```bash
bun run performance
```

The command regenerates types, builds both manifests, verifies their WASM size and parity, runs Matchstick, extracts the 1,000-event fixture throughput, benchmarks the mapping's rarity hot path, measures the installed dependency tree, and fails when any budget is exceeded.

The initial budgets intentionally leave roughly 40% or more local headroom and broad CI headroom for Graph compiler startup. Tighten them only from repeated measurements on the same runner class. A one-off faster developer machine is not a reason to reduce a shared threshold.

## Live query and indexing validation

The frontend's legacy Studio endpoint was checked on 2026-09-07:

```text
https://api.studio.thegraph.com/query/7093/nifty-league-sepolia/version/latest
```

It returned `deployment u7093/s53846/latest does not exist`. The current production deployment was then resolved from the `app` project's production environment without printing or persisting its ID or access token. The current deployment passed all three live query budgets with p95 latency from 108 to 131 ms, reported no indexing errors, advanced two blocks during the 15-second sample, and finished at the Ethereum head.

Once a current endpoint is available, run the credential-safe live audit. The URL and optional token are read from the environment and are never printed:

```bash
SUBGRAPH_PERFORMANCE_URL=https://gateway.example/graphql \
SUBGRAPH_PERFORMANCE_TOKEN=optional-bearer-token \
SUBGRAPH_CHAIN_RPC_URL=https://ethereum-rpc.example \
bun run performance:live
```

The live mode warms each query, records five samples for metadata, a 25-character relation page, and a 25-owner leaderboard page, then enforces p95 <= 1,500 ms and max <= 3,000 ms. It samples `_meta.block.number` and the source-chain head over 15 seconds, requires no indexing errors, and permits at most 25 blocks of lag. A zero block delta is informative but not automatically a failure because the source chain or deployment can legitimately be idle.

## Release validation requirements

A release candidate is validated only when all applicable gates below are recorded:

1. `bun install --frozen-lockfile`
2. `bun run format:check`
3. `bun run lint`
4. `bun run codegen`
5. `bun run build:mainnet`
6. `bun run build:sepolia`
7. `bun run test`
8. `bun run test:integration`
9. `bun run test:coverage`
10. `bun run performance`
11. `bun run audit`
12. `bun run performance:live` against the candidate deployment, followed by a source-chain head comparison

The local performance gate is suitable for pull requests. The live gate belongs after a candidate deployment and before promotion. A skipped live check is not a pass.
