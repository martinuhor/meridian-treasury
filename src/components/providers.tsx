"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { chainId } from "@/lib/chain";
import { DemoAuthBridge } from "@/components/demo-auth-bridge";
import { WagmiShell } from "@/components/wagmi-shell";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const hasPrivy = Boolean(privyAppId && privyAppId !== "your-privy-app-id");

const PrivyStack = dynamic(
  () => import("@/components/privy-stack").then((m) => m.PrivyStack),
  { ssr: false },
);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false },
        },
      }),
  );

  const inner = (
    <QueryClientProvider client={queryClient}>
      <WagmiShell>{children}</WagmiShell>
      <Toaster richColors position="top-right" closeButton />
    </QueryClientProvider>
  );

  if (!hasPrivy) {
    return <DemoAuthBridge>{inner}</DemoAuthBridge>;
  }

  return <PrivyStack appId={privyAppId}>{inner}</PrivyStack>;
}

export function isPrivyConfigured() {
  return hasPrivy;
}

export function getConfiguredChainId() {
  return chainId;
}
