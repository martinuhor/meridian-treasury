"use client";

import { useProfile } from "@/components/profile-context";
import { VaultPanel } from "@/components/treasury/vault-panel";

export default function TreasuryPage() {
  const profile = useProfile();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-slate-900">
          Treasury vault
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sweep idle USDC into audited USD Treasury yield and project compound
          returns over five years.
        </p>
      </div>
<VaultPanel walletAddress={profile.walletAddress} />
    </div>
  );
}
