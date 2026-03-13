# Contributing

Verbum is built in public and optimized for small, sharp contributions.

## Development

```bash
npm install
npm run build
npm test
```

## Workspaces

- `packages/verbum`: publishable TypeScript framework package
- `apps/web`: marketing site, docs, and native app overview
- `docs`: launch collateral and demo scripts

## Ground Rules

- Keep the core package dependency-light.
- Prefer improving examples and docs alongside API changes.
- Add tests for router behavior and actor contracts.
- Be explicit about what is live today versus roadmap.

## Release Flow

1. Open a PR with passing CI.
2. Cut a GitHub release.
3. Publish `verbum` to npm from the release workflow.
4. Deploy `apps/web` to Vercel.
