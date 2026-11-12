"use client";

import { useAuthAdapter } from "@/components/auth-context";

export function useAuth() {
  return useAuthAdapter();
}
