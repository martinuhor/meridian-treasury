"use client";

import { useMemo, type ReactNode } from "react";
import { AuthAdapterProvider } from "@/components/auth-context";
import { usePrivyAuthLive } from "@/hooks/use-privy-auth-live";

export function PrivyAuthAdapter({ children }: { children: ReactNode }) {
  const privy = usePrivyAuthLive();
  const value = useMemo(
    () => ({
      ...privy,
      isDemo: false,
    }),
    [privy],
  );
  return <AuthAdapterProvider value={value}>{children}</AuthAdapterProvider>;
}
