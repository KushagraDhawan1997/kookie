"use client";

import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  ToolbarButton,
} from "@kushagradhawan/kookie-ui-react";

import { setAppearance, useAppearance, type AppearanceChoice } from "./appearance";
import { MoonIcon, SunIcon, SystemIcon } from "./icons";

const CHOICES: readonly AppearanceChoice[] = ["system", "light", "dark"];
const LABELS: Record<AppearanceChoice, string> = { system: "System", light: "Light", dark: "Dark" };
const MARKS: Record<AppearanceChoice, () => React.ReactElement> = {
  system: SystemIcon,
  light: SunIcon,
  dark: MoonIcon,
};

/** The v2 docs' appearance menu: system, light or dark. No tooltip, because two floating
    triggers on one element lose the menu's anchor (see the docs' own note). */
export function AppearanceToggle() {
  const { choice } = useAppearance();
  const Mark = MARKS[choice];
  return (
    <Menu>
      <MenuTrigger
        render={
          <ToolbarButton iconOnly aria-label={`Appearance: ${LABELS[choice]}`}>
            <Mark />
          </ToolbarButton>
        }
      />
      <MenuContent>
        <MenuRadioGroup value={choice} onValueChange={(value) => setAppearance(value as AppearanceChoice)}>
          {CHOICES.map((c) => (
            <MenuRadioItem key={c} value={c} closeOnClick>
              {LABELS[c]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
