import { Monitor, Moon, Sun } from "lucide-react";

import type { Theme } from "@/lib/theme";

import { useTheme } from "@/lib/theme";

const themes = [
  { id: "light" as Theme, icon: Sun, label: "Light" },
  { id: "system" as Theme, icon: Monitor, label: "System" },
  { id: "dark" as Theme, icon: Moon, label: "Dark" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex gap-2">
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl transition-all ${
            theme === t.id ?
              "bg-primary/10 text-primary border border-primary/20"
            : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <t.icon size={20} />
          <span className="text-xs font-black uppercase tracking-wider">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
