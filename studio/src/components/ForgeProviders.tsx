import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ForgeErrorBoundary } from "./ForgeErrorBoundary";
import { ForgeToaster } from "./ForgeToaster";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function ForgeProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <ForgeErrorBoundary>
          {children}
          <ForgeToaster />
        </ForgeErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}