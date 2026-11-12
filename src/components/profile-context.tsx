"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SerializedBusiness, SerializedUser } from "@/lib/types";

export type Profile = SerializedUser & { business: SerializedBusiness | null };

const ProfileContext = createContext<Profile | null>(null);

export function ProfileProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  return (
    <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return ctx;
}
