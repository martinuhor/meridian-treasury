"use client";

import { AuthGate } from "@/components/auth-gate";
import { DashboardShell } from "@/components/dashboard/shell";
import { useProfile } from "@/components/profile-context";

function ShellWithProfile({ children }: { children: React.ReactNode }) {
  const profile = useProfile();
  return (
    <DashboardShell
      businessName={profile.business?.name ?? "Business"}
      walletAddress={profile.walletAddress}
    >
      {children}
    </DashboardShell>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <ShellWithProfile>{children}</ShellWithProfile>
    </AuthGate>
  );
}
