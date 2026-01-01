/**
 * Settings Navigation
 *
 * Navigation component for the settings sheet.
 * Provides a vertical menu to switch between settings sections.
 */

import { Book, Bot, FileText, Gauge, Palette, SpellCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SettingsSection =
  | "ai-server"
  | "ai-prompts"
  | "appearance"
  | "spellcheck"
  | "glossary"
  | "confidence";

export interface SettingsSectionItem {
  id: SettingsSection;
  label: string;
  description: string;
  icon: typeof Bot;
}

export const SETTINGS_SECTIONS: SettingsSectionItem[] = [
  {
    id: "ai-server",
    label: "AI Providers",
    description: "Configure AI connections",
    icon: Bot,
  },
  {
    id: "ai-prompts",
    label: "AI Prompts",
    description: "Speaker & text prompts",
    icon: FileText,
  },
  {
    id: "spellcheck",
    label: "Spellcheck",
    description: "Languages & ignored words",
    icon: SpellCheck,
  },
  {
    id: "glossary",
    label: "Glossary",
    description: "Terms & fuzzy matching",
    icon: Book,
  },
  {
    id: "confidence",
    label: "Confidence",
    description: "Low confidence highlighting",
    icon: Gauge,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme and display",
    icon: Palette,
  },
];

interface SettingsNavProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export function SettingsNav({ activeSection, onSectionChange }: SettingsNavProps) {
  return (
    <nav className="flex flex-col gap-1 p-2" aria-label="Settings navigation">
      {SETTINGS_SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;

        return (
          <Button
            key={section.id}
            variant="ghost"
            size="sm"
            onClick={() => onSectionChange(section.id)}
            data-testid={`settings-nav-${section.id}`}
            className={cn(
              "justify-start gap-3 h-auto py-2 px-3",
              isActive && "bg-accent text-accent-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="flex flex-col items-start text-left min-w-0 w-full">
              <span className="text-sm font-medium leading-tight break-words w-full">
                {section.label}
              </span>
              <span className="text-xs text-muted-foreground leading-tight break-words w-full">
                {section.description}
              </span>
            </div>
          </Button>
        );
      })}
    </nav>
  );
}
