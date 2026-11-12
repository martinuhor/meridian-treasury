"use client";

import { createConfig, http } from "wagmi";
import { activeChain, rpcUrl } from "@/lib/chain";

/**
 * Read-only wagmi config (balances / vault reads).
 * Wallet writes for checkout use a direct browser-provider helper
 * to avoid optional @wagmi/connectors → Coinbase CDP / x402 deps.
 */
export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors: [],
  transports: {
    [activeChain.id]: http(rpcUrl),
  },
  multiInjectedProviderDiscovery: false,
  ssr: true,
});
