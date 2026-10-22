"use client";

import * as React from "react";
import { ToolbarButton, ToolbarGroup } from "@kushagradhawan/kookie-ui-react";

import { LinkedInIcon, MailIcon, XLogoIcon } from "./icons";

const EMAIL = "hello@kushagradhawan.com";

/** How long the tick stays before the envelope comes back. Button's done state leaves the timer to the app. */
const DONE_MS = 1600;

export const SOCIALS = [
  { label: "X", href: "https://x.com/kushagra_dhawan", Icon: XLogoIcon },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/kushagra-dhawan/", Icon: LinkedInIcon },
] as const;

/** Copies the address rather than opening a mail app, then shows Button's done tick. */
function CopyEmailButton() {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL);
    } catch {
      // Clipboard can be refused (insecure origin, permissions). Fall back to the mail app.
      window.location.href = `mailto:${EMAIL}`;
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), DONE_MS);
  };

  return (
    <ToolbarButton iconOnly aria-label={copied ? "Email copied" : `Copy email, ${EMAIL}`} done={copied} onClick={copy}>
      <MailIcon />
    </ToolbarButton>
  );
}

/** The header's right cluster before the appearance toggle: copy email, then X and LinkedIn. */
export function HeaderActions() {
  return (
    <>
      <CopyEmailButton />
      <ToolbarGroup aria-label="Socials">
      {SOCIALS.map(({ label, href, Icon }) => (
        <ToolbarButton
          key={href}
          iconOnly
          aria-label={label}
          // An anchor, so it must announce as a link; the toolbar's non-native kit would otherwise stamp role="button".
          role="link"
          nativeButton={false}
          render={<a href={href} rel="noreferrer noopener" target="_blank" />}
        >
          <Icon />
        </ToolbarButton>
      ))}
      </ToolbarGroup>
    </>
  );
}
