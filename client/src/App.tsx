import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { TranscriptEditor } from "@/components/TranscriptEditor";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { queryClient } from "./lib/queryClient";

function Router() {
  return (
    <Switch>
      <Route path="/" component={TranscriptEditor} />
      <Route component={NotFound} />
    </Switch>
  );
}

export function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}

export default App;
