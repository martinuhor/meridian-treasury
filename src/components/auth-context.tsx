"use client";

import { createContext, useContext, type ReactNode } from "react";

export type AuthAdapter = {
  ready: boolean;
  authenticated: boolean;
  user: {
    id: string;
    email?: { address?: string } | string | null;
    wallet?: { address?: string } | null;
  } | null;
  login: () => void;
  logout: () => void | Promise<void>;
  walletAddress: string | null;
  getAccessToken: () => Promise<string | null>;
  isDemo: boolean;
};

const AuthContext = createContext<AuthAdapter | null>(null);

export function AuthAdapterProvider({
  value,
  children,
}: {
  value: AuthAdapter;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthAdapter() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthAdapter must be used within AuthAdapterProvider");
  }
  return ctx;
}
