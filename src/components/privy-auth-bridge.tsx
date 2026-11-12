"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { activeChain } from "@/lib/chain";

export function PrivyAuthBridge({
  appId,
  children,
}: {
  appId: string;
  children: ReactNode;
}) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        appearance: {
          theme: "light",
          accentColor: "#0f172a",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: activeChain,
        supportedChains: [activeChain],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
