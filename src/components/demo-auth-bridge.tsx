"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { DemoAuthProvider, useDemoAuth } from "@/components/demo-auth-provider";
import { AuthAdapterProvider } from "@/components/auth-context";

async function demoGetAccessToken() {
  return null as string | null;
}

function DemoAuthAdapterInner({ children }: { children: ReactNode }) {
  const demo = useDemoAuth();
  const getAccessToken = useCallback(demoGetAccessToken, []);
  const value = useMemo(
    () => ({
      ready: demo.ready,
      authenticated: demo.authenticated,
      user: demo.user
        ? {
            id: demo.user.id,
            email: { address: demo.user.email },
            wallet: demo.user.wallet,
          }
        : null,
      login: demo.login,
      logout: demo.logout,
      walletAddress: demo.user?.wallet.address ?? null,
      getAccessToken,
      isDemo: true,
    }),
    [demo, getAccessToken],
  );

  return <AuthAdapterProvider value={value}>{children}</AuthAdapterProvider>;
}

export function DemoAuthBridge({ children }: { children: ReactNode }) {
  return (
    <DemoAuthProvider>
      <DemoAuthAdapterInner>{children}</DemoAuthAdapterInner>
    </DemoAuthProvider>
  );
}
