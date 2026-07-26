## Description

<!-- Summarize the change. Link to any related issues. -->

## CI Status (do not merge until all pass)

- [ ] `Build, Format, Lint & Type Check` — `bun run lint && bun run type:check && bun run build`
- [ ] `Test` — `bun run test`

## Compliance Checklist

- [ ] My commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`type(scope): message`)
- [ ] I have run `bun run format:fix` before committing (or let lint-staged handle it)
- [ ] I have run `bun run codegen` if schema was modified
- [ ] No generated artifacts committed (`build/`, `generated/`, `node_modules/`)
- [ ] No `.env*.local`, `node_modules`, or lockfile churn from another package manager

## Additional Context

<!-- Anything reviewers should know: migration steps, env changes, breaking schema changes, related PRs. -->
