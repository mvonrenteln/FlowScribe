/**
 * Appearance Settings
 *
 * Theme and visual appearance settings.
 */

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

interface ThemeOption {
  value: Theme;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    icon: Sun,
    description: "Light mode with bright backgrounds",
  },
  {
    value: "dark",
    label: "Dark",
    icon: Moon,
    description: "Dark mode for reduced eye strain",
  },
  {
    value: "system",
    label: "System",
    icon: Monitor,
    description: "Follow your operating system preference",
  },
];

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const effectiveTheme = theme === "system" ? getSystemPreference() : theme;
  document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
}

export function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const handleThemeChange = (value: Theme) => {
    setTheme(value);
    localStorage.setItem("theme", value);
    applyTheme(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of the application.
        </p>
      </div>

      {/* Theme Selection */}
      <div className="space-y-4">
        <Label className="text-base">Theme</Label>
        <RadioGroup
          value={theme}
          onValueChange={(value) => handleThemeChange(value as Theme)}
          className="grid gap-3 sm:grid-cols-3"
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = theme === option.value;
            const radioId = `theme-option-${option.value}`;

            return (
              <label
                key={option.value}
                htmlFor={radioId}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50",
                )}
              >
                <RadioGroupItem
                  id={radioId}
                  value={option.value}
                  className="sr-only"
                  data-testid={`radio-theme-${option.value}`}
                />
                <div
                  className={cn(
                    "rounded-full p-3",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </label>
            );
          })}
        </RadioGroup>
      </div>

      {/* Additional appearance settings can be added here in the future */}
      {/* Examples: Font size, color accents, density, etc. */}
    </div>
  );
}
