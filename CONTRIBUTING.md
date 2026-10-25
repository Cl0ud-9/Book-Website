# Contributing to The Bookshelf

Thanks for wanting to help. Bug reports, ideas and pull requests are welcome. Please keep to the
[code of conduct](CODE_OF_CONDUCT.md).

The project is source-available, not open source: see [LICENSE](LICENSE). You may fork it to prepare contributions,
but not to publish your own copies. By opening a pull request you agree to clause 8 of the license.

## Working on it

The site is built with Astro and TypeScript (Node.js 22.12 or newer):

```bash
npm install
npm run assets:pull   # the books and covers (or python pipeline/library.py: see the README, Run it)
npm run dev           # http://localhost:4321
```

Pages are in `src/pages`, the parts they share in `src/components`, and the books and everything worked out from them
in `src/lib`. Styles live in `src/styles/main.css` and every animation in `src/scripts/app.js`. The generated site
(`dist/`) and the books and covers (`.assets/`) are not committed.

## What a pull request needs

- `npm run check`, `npm run build`, `npm run check:links` and `npm run test:e2e` pass (the browser checks need Python,
  Playwright and Google Chrome). The Check workflow runs them on every pull request.
- Anything that moves also works with reduced motion turned on, and the page still reads without JavaScript.
- Visual changes include before and after screenshots, at desktop width and on a phone.
- New images are ones you have the right to publish.

Match the surrounding code, and keep wording plain.
