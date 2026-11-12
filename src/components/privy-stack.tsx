"use client";

import type { ReactNode } from "react";
import { PrivyAuthBridge } from "@/components/privy-auth-bridge";
import { PrivyAuthAdapter } from "@/components/privy-auth-adapter";

export function PrivyStack({
  appId,
  children,
}: {
  appId: string;
  children: ReactNode;
}) {
  return (
    <PrivyAuthBridge appId={appId}>
      <PrivyAuthAdapter>{children}</PrivyAuthAdapter>
    </PrivyAuthBridge>
  );
}
