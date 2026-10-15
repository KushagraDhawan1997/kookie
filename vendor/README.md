# Kookie UI snapshot

The site pins `@kushagradhawan/kookie-ui-react@0.0.0-site.1`, packed from `kookie-ui-v2` main at `d32836a`. Only the version in package/package.json differs from v2's own `pnpm pack` output. Vendored so Vercel can build without the sibling repo.

To refresh: build `packages/ui` in kookie-ui-v2, pack it, bump the `site.N` version, and update every reference. A new version is required; pnpm reuses a lockfile entry whose name and version are unchanged.

SHA-256: `9eedd4bdcbea497a8964fe7825746ad79ea037aa24aaa96ea666e179a0d56681`
