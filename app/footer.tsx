import { Box } from "@kushagradhawan/kookie-ui-react";

import { Footer } from "../blocks/footer";
import { Logo } from "./logo";
import { PRODUCTS } from "./site";

/** The site's floor, the same footer block as kushagradhawan.com, signed with the mark. */
export function SiteFooter() {
  return (
    <Box py="10" className="column">
      <Footer
        brand={<Logo height="var(--line-height-8)" />}
        groups={[
          {
            title: "Contact",
            links: [
              { label: "hello@kushagradhawan.com", href: "mailto:hello@kushagradhawan.com" },
              { label: "GitHub", href: "https://github.com/KushagraDhawan1997" },
              { label: "X", href: "https://x.com/kushagra_dhawan" },
              { label: "LinkedIn", href: "https://www.linkedin.com/in/kushagra-dhawan/" },
            ],
          },
          {
            title: "Products",
            links: PRODUCTS.map((product) => ({ label: product.name, href: product.href })),
          },
          {
            title: "Made by",
            links: [{ label: "Kushagra Dhawan", href: "https://kushagradhawan.com" }],
          },
        ]}
        note="© 2026 Kushagra Dhawan. Valencia, Spain."
      />
    </Box>
  );
}
