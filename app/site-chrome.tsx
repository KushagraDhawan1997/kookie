import {
  Flex,
  Shell,
  ShellContent,
  ShellPaneHeader,
  ShellScroll,
  Toolbar,
  ToolbarTitle,
} from "@kushagradhawan/kookie-ui-react";

import { AppearanceToggle } from "./appearance-toggle";
import { BackButton } from "./back-button";
import { HeaderActions } from "./header-actions";

/**
 * The same chrome as kushagradhawan.com: a floating band over a faded scroller. The band's
 * title mirrors the `Page` below it and arrives once the page title scrolls behind it.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <ShellContent flush>
        <ShellPaneHeader float>
          <Toolbar backdrop size="3">
            <Flex gap="2" align="center">
              <BackButton />
              <ToolbarTitle />
            </Flex>
            <Flex gap="2" align="center">
              <HeaderActions />
              <AppearanceToggle />
            </Flex>
          </Toolbar>
        </ShellPaneHeader>
        <ShellScroll fade>{children}</ShellScroll>
      </ShellContent>
    </Shell>
  );
}
