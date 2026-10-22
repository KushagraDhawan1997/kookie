"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToolbarButton } from "@kushagradhawan/kookie-ui-react";

import { HomeIcon } from "./icons";

/** The way home, in the top bar. Nothing to go back to on the home page itself. */
export function BackButton() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <ToolbarButton iconOnly aria-label="Back to home" nativeButton={false} render={<Link href="/" />}>
      <HomeIcon />
    </ToolbarButton>
  );
}
