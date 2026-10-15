# kookie

The landing page at [kookie.design](https://kookie.design). It lists the Kookie products and links out to each one.

Next.js 16 and React 19, styled with Kookie UI. Kookie UI is not on npm yet, so a packed snapshot lives in `vendor/`; see `vendor/README.md` to refresh it.

```sh
pnpm install
pnpm dev     # http://localhost:3010
pnpm build
```

`next.config.ts` also redirects the old hellokookie.com domain: docs paths go to [womp-ui.kookie.design](https://womp-ui.kookie.design), everything else to kookie.design.

Made by [Kushagra Dhawan](https://kushagradhawan.com).
