import { Box, Heading, Link, Page, Stack, Text } from "@kushagradhawan/kookie-ui-react";

import { SiteFooter } from "./footer";
import { DESCRIPTION, PRODUCTS, SITE_NAME, type Product } from "./site";

const INTRO =
  "Kookie is a set of creative tools made by Kushagra Dhawan, with the libraries they are built on. A tool is made only when it is needed, and each one is kept to a high standard.";

function ProductRow({ product }: { product: Product }) {
  return (
    <Stack gap="1" align="start">
      <Link size="3" href={product.href}>
        {product.name}
      </Link>
      <Text size="3" emphasis="medium" render={<p />}>
        {product.blurb}
      </Text>
    </Stack>
  );
}

export default function Home() {
  return (
    <Stack gap="10">
      <Box className="column">
        <Page title={SITE_NAME} description={DESCRIPTION}>
          <Stack gap="10">
            <Text size="4" render={<p />}>
              {INTRO}
            </Text>

            <Stack gap="4">
              <Heading size="5" render={<h2 />}>
                Products
              </Heading>
              <Stack gap="6">
                {PRODUCTS.map((product) => (
                  <ProductRow key={product.name} product={product} />
                ))}
              </Stack>
            </Stack>
          </Stack>
        </Page>
      </Box>
      <SiteFooter />
    </Stack>
  );
}
