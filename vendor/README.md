# Kookie UI snapshot

The site pins `@kushagradhawan/kookie-ui-react@0.0.0-site.3`, packed from `kookie-ui-v2` main at `d2db5eb` (pink and purple families, section tints). Only the version in package/package.json differs from v2's own `pnpm pack` output. Vendored so Vercel can build without the sibling repo.

To refresh: build `packages/ui` in kookie-ui-v2, pack it, bump the `site.N` version, and update every reference. A new version is required; pnpm reuses a lockfile entry whose name and version are unchanged.

SHA-256: `30eb6050a0e9ab5a2b5071dd59481545f72a5664f75c89605b208b953bb23f61`
