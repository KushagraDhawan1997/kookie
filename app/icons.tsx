/** Hugeicons behind named wrappers, as on kushagradhawan.com: decorative, stroke from the system. */
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ComputerIcon,
  Home01Icon,
  Linkedin01Icon,
  Mail01Icon,
  Moon02Icon,
  NewTwitterIcon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { iconStroke } from "@kushagradhawan/kookie-ui-react";

const glyph = (icon: IconSvgElement) =>
  function Glyph() {
    return <HugeiconsIcon icon={icon} strokeWidth={iconStroke} aria-hidden />;
  };

export const HomeIcon = glyph(Home01Icon);
export const SunIcon = glyph(Sun03Icon);
export const MoonIcon = glyph(Moon02Icon);
export const SystemIcon = glyph(ComputerIcon);
export const MailIcon = glyph(Mail01Icon);
export const XLogoIcon = glyph(NewTwitterIcon);
export const LinkedInIcon = glyph(Linkedin01Icon);
