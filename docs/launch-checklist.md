# Launch Checklist

## Product

- Ship the core `verbum` package
- Ship the static docs/marketing site
- Ship the native macOS app
- Keep collaboration and P2P clearly marked as roadmap

## Repo

- Push to GitHub
- Add the repo description and social preview
- Turn on Discussions or a Discord link if you want contributor energy fast
- Add `good first issue` labels after launch

## Package

- Verify `npm run build --workspace verbum`
- Verify `npm test --workspace verbum`
- Publish with `npm publish --workspace verbum --access public`

## Site

- Point Vercel at `apps/web`
- Add the production domain
- Make sure the docs page and app overview page both build cleanly

## Native app

- Run `npm run dev --workspace @verbum/mac`
- Record the graph, inbox, terminals, and search flowing together
- Capture one polished screenshot for the README and tweet

## Launch

- Post the announcement clip on X
- Immediately reply with the repo link, docs link, and `npm install verbum`
- Submit Show HN with the same clip and a short honest explanation
- Stay online for the first two hours and answer comments fast
