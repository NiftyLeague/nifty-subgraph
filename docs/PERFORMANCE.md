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

The frontend endpoint above is dead and must not be restored by editing this document. The current production deployment is resolved from the `app` project's production environment, and its identifier and access token are deliberately absent from the repository. Record the resolved query endpoint in the `SUBGRAPH_PERFORMANCE_URL` repository variable instead; never in a tracked file, a workflow, or an issue.

## Deployment health monitoring

`Subgraph Deployment Health` (`.github/workflows/subgraph-health.yml`) runs every six hours and on manual dispatch, with one lane per environment. Each lane runs the credential-safe live audit against its configured deployment, renders the result with `scripts/health-summary.mjs`, and reports indexing errors, the indexed block range, the source-chain head, and block lag.

Repository configuration, all of it outside the repository:

| Setting                              | Kind                | Required | Purpose                                               |
| ------------------------------------ | ------------------- | -------- | ----------------------------------------------------- |
| `SUBGRAPH_PERFORMANCE_URL`           | Repository variable | Yes      | GraphQL endpoint of the production deployment         |
| `SUBGRAPH_CHAIN_RPC_URL`             | Repository variable | Yes      | Source-chain JSON-RPC used for the lag sample         |
| `SUBGRAPH_PERFORMANCE_TOKEN`         | Repository secret   | No       | Bearer token when the endpoint requires one           |
| `SUBGRAPH_STAGING_PERFORMANCE_URL`   | Repository variable | Yes      | GraphQL endpoint of the staging deployment            |
| `SUBGRAPH_STAGING_CHAIN_RPC_URL`     | Repository variable | Yes      | Source-chain JSON-RPC used for the staging lag sample |
| `SUBGRAPH_STAGING_PERFORMANCE_TOKEN` | Repository secret   | No       | Bearer token when the staging endpoint requires one   |

The production names are listed in `.env.example` for local runs. The staging lane mirrors production one-for-one against the `SUBGRAPH_STAGING_*` names so the environments can never cross-wire endpoints or tokens. Each lane tracks its own incidents under the `health-check` (production) or `health-check-staging` (staging) label. With either lane's required settings absent, that lane reports that it is not configured and does not raise an incident; the shared `docker-compose.yml` graph-node stack is laptop-local, so staging monitoring requires pointing the staging variables at a deployment a runner can reach.

The probe is credential safe by construction. The audit report records query timings, block numbers, and whether a bearer token was used, never the endpoint or the token; the workflow captures the audit's own error text instead of echoing it, because a failed fetch would otherwise print the endpoint, and this repository is public. The verdict comes from the `live.*` checks only, so a slow local build budget on the runner cannot be reported as a deployment incident.

Results are tracked through one issue labeled `health-check`: the first degraded run opens it, later degraded runs comment on it, and the first healthy run closes it with the recovering summary. The JSON report is kept as a seven-day artifact for diagnosis. Reproduce a failure locally with `bun run performance:live` and the variables above rather than from the run log.

## Staging

Staging is the local graph-node stack in `docker-compose.yml`, which is the deployment the `dev`, `create-local`, and `deploy-local` scripts target. Bring it up with an Ethereum RPC reachable at `host.docker.internal:8545`:

```bash
docker compose up -d
bun run dev
```

| Endpoint                                                    | Purpose                                     |
| ----------------------------------------------------------- | ------------------------------------------- |
| `http://localhost:8000/`                                    | GraphiQL                                    |
| `http://localhost:8000/subgraphs/name/nifty-league-sepolia` | Deployed subgraph queries                   |
| `http://localhost:8020/`                                    | graph-node admin API used by `graph deploy` |
| `ws://localhost:8001/subgraphs/name/nifty-league-sepolia`   | Subscriptions                               |
| `http://localhost:5001`                                     | IPFS API                                    |
| `postgresql://localhost:5432/graph-node`                    | graph-node database                         |

To monitor a shared staging deployment instead of a laptop, set `SUBGRAPH_PERFORMANCE_URL` to its query endpoint and `SUBGRAPH_CHAIN_RPC_URL` to its source-chain RPC; the same scheduled probe then covers staging. The ports above are refused unless the compose stack is running, which is why a scheduled run cannot see a laptop-local staging node.

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

Code Foundry runs the local gate as `Validation / Test / Performance` on pull requests. The live gate belongs after a candidate deployment and before promotion. A skipped live check is not a pass.
