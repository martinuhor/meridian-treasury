"use client";

import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

export function WagmiShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  // Always render children so landing CTAs work even if wallet libs are slow.
  if (!ready) return <>{children}</>;

  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
