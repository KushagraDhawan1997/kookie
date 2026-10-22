import type { NextConfig } from "next";

/**
 * hellokookie.com was the Womp's Design System docs. Its domain points here now, and every
 * request on it is sent on: the docs paths to womp-ui.kookie.design, everything else to the
 * same path on kookie.design. Scoped by host, so kookie.design itself is never redirected.
 * www.kookie.design to the apex is a Vercel domain setting, not code.
 */
const LEGACY_HOST = [{ type: "host" as const, value: "(www\\.)?hellokookie\\.com" }];
const WOMP_UI = "https://womp-ui.kookie.design";

// The theme pages that became chapters (kookie-ui apps/docs/next.config.ts), sent straight to
// their final address rather than through a second redirect.
const MOVED: [string, string][] = [
  ["/docs/installation", "/start/installation"],
  ["/docs/theme", "/start/theming"],
  ["/docs/colors", "/foundations/color"],
  ["/docs/typography", "/foundations/typography"],
  ["/docs/radius", "/foundations/radius"],
  ["/docs/material", "/foundations/materials"],
  ["/docs/shadows", "/foundations/depth"],
  ["/docs/constants", "/foundations/constants"],
];

const DOCS_SECTIONS = ["docs", "start", "foundations", "patterns", "ui-test"];

const nextConfig: NextConfig = {
  // `next dev` otherwise writes an AGENTS.md into the repo. Same setting as kushagradhawan.com.
  agentRules: false,
  async redirects() {
    return [
      ...MOVED.map(([source, target]) => ({
        source,
        has: LEGACY_HOST,
        destination: `${WOMP_UI}${target}`,
        permanent: true,
      })),
      ...DOCS_SECTIONS.map((section) => ({
        source: `/${section}/:path*`,
        has: LEGACY_HOST,
        destination: `${WOMP_UI}/${section}/:path*`,
        permanent: true,
      })),
      {
        source: "/:path*",
        has: LEGACY_HOST,
        destination: "https://kookie.design/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
