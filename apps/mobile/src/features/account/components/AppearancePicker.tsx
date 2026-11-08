import { THEME_PREFERENCES } from "@shared/users/settings";
import type { ThemePreference } from "@shared/users/settings";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SegmentOption } from "@/components/ui/segmented-control";
import { useThemePreference } from "@/hooks/useTheme";

import { Section } from "./Section";

const LABELS: Record<ThemePreference, Omit<SegmentOption<ThemePreference>, "value">> = {
  light: { label: "Light", icon: "sun.max.fill" },
  system: { label: "System", icon: "circle.lefthalf.filled" },
  dark: { label: "Dark", icon: "moon.fill" },
};

const OPTIONS = THEME_PREFERENCES.map((value) => ({ value, ...LABELS[value] }));

/** Light / System / Dark for the whole app, kept on this phone. */
export function AppearancePicker() {
  const { preference, setPreference } = useThemePreference();

  return (
    <Section title="Appearance" footer="System matches your iPhone's light or dark setting.">
      <SegmentedControl
        options={OPTIONS}
        value={preference}
        onChange={setPreference}
        accessibilityLabel="Appearance"
      />
    </Section>
  );
}
