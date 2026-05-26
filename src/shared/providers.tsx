"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/contexts/auth-context";
import { EmpresaProvider } from "@/features/empresa/contexts/empresa-context";
import { AyudaProvider } from "@/features/ajustes/contexts/ayuda-context";
import { MarketingProvider } from "@/features/marketing/contexts/marketing-context";
import { ViewModeProvider } from "@/features/layout/contexts/view-mode-context";
import { GlobalLoadingOverlay } from "@/shared/components/GlobalLoadingOverlay";
import { NavigationLoadingDetector } from "@/shared/components/NavigationLoadingDetector";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <EmpresaProvider>
            <AyudaProvider>
              <MarketingProvider>
                <ViewModeProvider>
                  {children}
                  <Toaster />
                  <Sonner />
                  <GlobalLoadingOverlay />
                  <Suspense fallback={null}>
                    <NavigationLoadingDetector />
                  </Suspense>
                </ViewModeProvider>
              </MarketingProvider>
            </AyudaProvider>
          </EmpresaProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
