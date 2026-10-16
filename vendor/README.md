# Kookie UI snapshot

The site pins `@kushagradhawan/kookie-ui-react@0.0.0-site.2`, packed from `kookie-ui-v2` main at `364c936`. Only the version in package/package.json differs from v2's own `pnpm pack` output. Vendored so Vercel can build without the sibling repo.

To refresh: build `packages/ui` in kookie-ui-v2, pack it, bump the `site.N` version, and update every reference. A new version is required; pnpm reuses a lockfile entry whose name and version are unchanged.

SHA-256: `d12e325aa5b9d7ef408ec4d73f6c72af0c85dee340c1c14da2167f1b53eac755`
