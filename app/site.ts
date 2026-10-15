export const SITE_URL = "https://kookie.design";
export const SITE_NAME = "Kookie";
export const DESCRIPTION = "Creative tools, and the libraries they are built on.";

export type Product = {
  name: string;
  /** One line, shown under the name. */
  blurb: string;
  href: string;
};

// Blurbs from kushagradhawan.com's product list, so the two sites say the same thing.
export const PRODUCTS: readonly Product[] = [
  {
    name: "Kookie UI",
    blurb: "A design system for React with strict rules, so every screen stays consistent.",
    href: "https://ui.kookie.design",
  },
  {
    name: "Kookie Flow",
    blurb: "A node editor for React that stays smooth with thousands of nodes.",
    href: "https://flow.kookie.design",
  },
  {
    name: "Kookie Studio",
    blurb: "A node canvas for AI images and video, where you can change one step without starting again.",
    // On GitHub until it launches.
    href: "https://github.com/KushagraDhawan1997/kookie-flow/tree/main/apps/studio",
  },
];

/** The older system, still maintained for Womp. Listed apart from the products above. */
export const LEGACY: Product = {
  name: "Womp's Design System",
  blurb: "The component package behind Womp's interface, built on Kookie UI v1.",
  href: "https://womp-ui.kookie.design",
};
