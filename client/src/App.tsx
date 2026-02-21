import { QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { TranscriptEditor } from "@/components/TranscriptEditor";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "./lib/queryClient";

export function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <TranscriptEditor />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}

export default App;
