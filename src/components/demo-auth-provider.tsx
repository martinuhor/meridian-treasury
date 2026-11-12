"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DemoUser = {
  id: string;
  email: string;
  wallet: { address: string };
};

type DemoAuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  user: DemoUser | null;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
};

const DemoAuthContext = createContext<DemoAuthContextValue | null>(null);

export const DEMO_AUTH_STORAGE_KEY = "meridian.demo.auth";

export function createDemoUser(): DemoUser {
  return {
    id: "demo-user",
    email: "founder@acme.africa",
    wallet: { address: "0xDemo000000000000000000000000000000000001" },
  };
}

export function persistDemoUser(user: DemoUser) {
  window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, JSON.stringify(user));
}

function loadInitial(): DemoUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoUser) : null;
  } catch {
    return null;
  }
}

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(loadInitial());
    setReady(true);
  }, []);

  const login = useCallback(() => {
    const next = createDemoUser();
    persistDemoUser(next);
    setUser(next);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      authenticated: Boolean(user),
      user,
      login,
      logout,
      getAccessToken: async () => "demo-token",
    }),
    [ready, user, login, logout],
  );

  return (
    <DemoAuthContext.Provider value={value}>{children}</DemoAuthContext.Provider>
  );
}

export function useDemoAuth() {
  const ctx = useContext(DemoAuthContext);
  if (!ctx) {
    throw new Error("useDemoAuth must be used within DemoAuthProvider");
  }
  return ctx;
}

export function useOptionalDemoAuth() {
  return useContext(DemoAuthContext);
}
