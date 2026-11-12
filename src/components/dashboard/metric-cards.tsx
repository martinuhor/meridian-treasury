"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdc } from "@/lib/utils";
import { siteConfig } from "@/config/site";

export function MetricCards({
  operatingBalance,
  vaultBalance,
  pendingInvoices,
  loading,
}: {
  operatingBalance: number;
  vaultBalance: number;
  pendingInvoices: number;
  loading?: boolean;
}) {
  const projected = vaultBalance * siteConfig.defaultNetApy;
  const items = [
    {
      label: "Operating Balance",
      hint: "Idle USDC",
      value: `$${formatUsdc(operatingBalance)}`,
    },
    {
      label: "Treasury Vault Balance",
      hint: "Earning yield",
      value: `$${formatUsdc(vaultBalance)}`,
    },
    {
      label: "Projected Annual Yield",
      hint: `Net ${(siteConfig.userYieldShare * 100).toFixed(0)}% · ${(siteConfig.defaultNetApy * 100).toFixed(2)}% APY`,
      value: `$${formatUsdc(projected)}`,
    },
    {
      label: "Pending Invoices",
      hint: "Open payment links",
      value: `$${formatUsdc(pendingInvoices)}`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="border-slate-200/80 bg-white/90">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {loading ? "—" : item.value}
            </p>
            <p className="mt-1 text-xs text-slate-400">{item.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
