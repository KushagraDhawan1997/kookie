import "@kushagradhawan/kookie-ui-react/styles.css";
import "@fontsource-variable/inter/wght.css";
import "./globals.css";

import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { Theme } from "@kushagradhawan/kookie-ui-react";

import { appearanceScript } from "./appearance-script";
import { DESCRIPTION, PRODUCTS, SITE_NAME, SITE_URL } from "./site";

const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: DESCRIPTION,
  authors: [{ name: "Kushagra Dhawan", url: "https://kushagradhawan.com" }],
  creator: "Kushagra Dhawan",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DESCRIPTION,
    creator: "@kushagra_dhawan",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      description: DESCRIPTION,
      founder: { "@type": "Person", name: "Kushagra Dhawan", url: "https://kushagradhawan.com" },
      sameAs: ["https://github.com/KushagraDhawan1997"],
      owns: PRODUCTS.map((product) => ({ "@type": "SoftwareApplication", name: product.name, url: product.href })),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
  ],
};

/**
 * Appearance lives on <html>, set by the pre-paint script, so the server never guesses and
 * the Theme inherits it. `suppressHydrationWarning` covers exactly the attributes it writes.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={interTight.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      </head>
      <body>
        <Theme appearance="inherit" size="3" material="3">
          {children}
        </Theme>
      </body>
    </html>
  );
}
