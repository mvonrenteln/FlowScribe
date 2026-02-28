/**
 * Settings Sheet
 *
 * Main container for the application settings.
 * Uses a Sheet (drawer) pattern for non-blocking access.
 */

import { Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SettingsNav, type SettingsSection } from "./SettingsNav";
import { AIServerSettings } from "./sections/AIServerSettings";
import { AITemplateSettings } from "./sections/AITemplateSettings";
import { AppearanceSettings } from "./sections/AppearanceSettings";
import { BackupSettings } from "./sections/BackupSettings";
import { ConfidenceSettings } from "./sections/ConfidenceSettings";
import { GlossarySettings } from "./sections/GlossarySettings";
import { SpellcheckSettings } from "./sections/SpellcheckSettings";

interface SettingsSheetProps {
  /** Controlled open state (optional) */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Initial section to display */
  initialSection?: SettingsSection;
  /** Whether to show the trigger button */
  showTrigger?: boolean;
}

export function SettingsSheet({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialSection = "ai-server",
  showTrigger = true,
}: SettingsSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeSection, setActiveSectionState] = useState<SettingsSection>(initialSection);
  const setActiveSection = useCallback((section: SettingsSection) => {
    setActiveSectionState(section);
  }, []);

  // Support both controlled and uncontrolled modes
  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = controlledOnOpenChange ?? setInternalOpen;

  // Sync activeSection when the sheet opens with a specific initialSection
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setActiveSection(initialSection);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, initialSection, setActiveSection]);

  const handleSectionChange = useCallback(
    (section: SettingsSection) => {
      setActiveSection(section);
    },
    [setActiveSection],
  );

  const renderContent = () => {
    switch (activeSection) {
      case "ai-server":
        return <AIServerSettings />;
      case "ai-prompts":
        return <AITemplateSettings />;

      case "appearance":
        return <AppearanceSettings />;
      case "spellcheck":
        return <SpellcheckSettings />;
      case "glossary":
        return <GlossarySettings />;
      case "confidence":
        return <ConfidenceSettings />;
      case "backup":
        return <BackupSettings />;
      default:
        return <AIServerSettings />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {showTrigger && (
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open settings"
            data-testid="button-settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </SheetTrigger>
      )}
      <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </SheetTitle>
          <SheetDescription>
            Configure AI providers, appearance, and other application settings.
          </SheetDescription>
        </SheetHeader>

        <div className="flex h-[calc(100vh-120px)]">
          {/* Navigation Sidebar */}
          <div className="w-56 border-r bg-muted/30 shrink-0">
            <SettingsNav activeSection={activeSection} onSectionChange={handleSectionChange} />
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto">
            <div className="p-6">{renderContent()}</div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Standalone settings button that opens the settings sheet.
 * Use this in the toolbar or other locations.
 */
export function SettingsButton() {
  return <SettingsSheet showTrigger={true} />;
}
