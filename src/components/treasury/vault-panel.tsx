"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { siteConfig } from "@/config/site";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { useVaultPosition } from "@/hooks/use-vault-position";
import { upsertYieldPositionAction } from "@/app/actions/treasury";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdc } from "@/lib/utils";

export function VaultPanel({
  walletAddress,
}: {
  walletAddress?: string | null;
}) {
  const [demoMode, setDemoMode] = useState(true);
  const [amount, setAmount] = useState("1000");
  const [demoOperating, setDemoOperating] = useState(12450.5);
  const [demoVault, setDemoVault] = useState(8200);
  const [busy, setBusy] = useState(false);

  const liveBalance = useUsdcBalance(walletAddress, demoOperating);
  const liveVault = useVaultPosition(walletAddress, demoVault);

  const operating = demoMode ? demoOperating : liveBalance.balance;
  const vault = demoMode ? demoVault : liveVault.assets;

  const projection = useMemo(() => {
    const years = [1, 2, 3, 4, 5];
    const principal = Number(amount) || 0;
    return years.map((year) => {
      const idle = principal;
      const vaulted = principal * Math.pow(1 + siteConfig.defaultNetApy, year);
      return {
        year,
        idle,
        vaulted,
        earned: vaulted - idle,
      };
    });
  }, [amount]);

  async function deposit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Enter a valid USDC amount");
      return;
    }
    if (value > operating) {
      toast.error("Amount exceeds operating balance");
      return;
    }
    setBusy(true);
    if (demoMode || liveBalance.isDemo) {
      const nextOperating = operating - value;
      const nextVault = vault + value;
      setDemoOperating(nextOperating);
      setDemoVault(nextVault);
      await upsertYieldPositionAction({
        depositedPrincipal: nextVault,
        sharesHeld: nextVault,
        lastDepositTxHash: `0xdemo-deposit-${Date.now()}`,
      });
      toast.success("Swept to Treasury Vault (demo)");
    } else {
      toast.message("Connect a funded wallet and configure NEXT_PUBLIC_VAULT_ADDRESS for live deposits.");
    }
    setBusy(false);
  }

  async function withdraw() {
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Enter a valid USDC amount");
      return;
    }
    if (value > vault) {
      toast.error("Amount exceeds vault balance");
      return;
    }
    setBusy(true);
    if (demoMode || liveVault.isDemo) {
      const nextOperating = operating + value;
      const nextVault = vault - value;
      setDemoOperating(nextOperating);
      setDemoVault(nextVault);
      await upsertYieldPositionAction({
        depositedPrincipal: nextVault,
        sharesHeld: nextVault,
        lastDepositTxHash: `0xdemo-withdraw-${Date.now()}`,
      });
      toast.success("Returned to operating account (demo)");
    } else {
      toast.message("Live withdrawals require a configured vault address.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">Demo / Testnet mode</p>
          <p className="text-xs text-slate-500">
            Simulate deposits and yield without mainnet USDC.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="demo-toggle" className="text-xs text-slate-500">
            {demoMode ? "On" : "Off"}
          </Label>
          <Switch
            id="demo-toggle"
            checked={demoMode}
            onCheckedChange={setDemoMode}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200/80 bg-white/90">
          <CardHeader>
            <CardTitle>Treasury vault</CardTitle>
            <CardDescription>
              Move idle USDC from your operating account into the US Treasury &amp;
              Institutional USDC vault.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-xs text-slate-400">Operating account</p>
                <p className="mt-1 font-mono text-lg tabular-nums text-slate-900">
                  ${formatUsdc(operating)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-xs text-slate-400">Vault balance</p>
                <p className="mt-1 font-mono text-lg tabular-nums text-slate-900">
                  ${formatUsdc(vault)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USDC)</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void deposit()} disabled={busy}>
                Sweep to vault
              </Button>
              <Button variant="outline" onClick={() => void withdraw()} disabled={busy}>
                Return to operating
              </Button>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              Fee split:{" "}
              <strong>{siteConfig.userYieldShare * 100}% user net yield</strong> /{" "}
              {siteConfig.platformFeeShare * 100}% Meridian platform fee. Net APY
              fallback {(siteConfig.defaultNetApy * 100).toFixed(2)}%.
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90">
          <CardHeader>
            <CardTitle>1–5 year compound projector</CardTitle>
            <CardDescription>
              Idle USDC (0%) vs Meridian Treasury Vault (~
              {(siteConfig.defaultNetApy * 100).toFixed(2)}% net APY).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Year</th>
                    <th className="pb-2 pr-4 font-medium">Idle</th>
                    <th className="pb-2 pr-4 font-medium">Vault</th>
                    <th className="pb-2 font-medium">Net earned</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.map((row) => (
                    <tr key={row.year} className="border-t border-slate-100">
                      <td className="py-2.5 pr-4 text-slate-600">{row.year}</td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums">
                        ${formatUsdc(row.idle)}
                      </td>
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-900">
                        ${formatUsdc(row.vaulted)}
                      </td>
                      <td className="py-2.5 font-mono tabular-nums text-emerald-700">
                        +${formatUsdc(row.earned)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 space-y-2">
              {projection.map((row) => {
                const max = projection[projection.length - 1]?.vaulted || 1;
                const width = Math.max(8, (row.vaulted / max) * 100);
                return (
                  <div key={`bar-${row.year}`} className="flex items-center gap-3">
                    <span className="w-10 text-xs text-slate-400">Y{row.year}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-900 transition-all duration-700"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
