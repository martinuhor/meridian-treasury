"use client";

import { useEffect, useMemo, useState } from "react";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { InvoicesTable } from "@/components/dashboard/invoices-table";
import { useProfile } from "@/components/profile-context";
import { listInvoicesAction } from "@/app/actions/invoices";
import { useUsdcBalance } from "@/hooks/use-usdc-balance";
import { useVaultPosition } from "@/hooks/use-vault-position";
import type { SerializedInvoice } from "@/lib/types";

export default function DashboardPage() {
  const profile = useProfile();
  const [invoices, setInvoices] = useState<SerializedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const operating = useUsdcBalance(profile.walletAddress);
  const vault = useVaultPosition(profile.walletAddress);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await listInvoicesAction();
      if (!cancelled) {
        setInvoices(result.invoices);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [profile.business?.id]);

  const pendingTotal = useMemo(
    () =>
      invoices
        .filter((i) => i.status === "PENDING")
        .reduce((sum, i) => sum + Number(i.amount), 0),
    [invoices],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-slate-900">
          Executive overview
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Live operating balance, treasury vault, and open payment links.
        </p>
      </div>
      <MetricCards
        operatingBalance={operating.balance}
        vaultBalance={vault.assets}
        pendingInvoices={pendingTotal}
        loading={loading || operating.isLoading || vault.isLoading}
      />
      <InvoicesTable
        invoices={invoices}
        onUpdated={(invoice) =>
          setInvoices((prev) =>
            prev.map((row) => (row.id === invoice.id ? invoice : row)),
          )
        }
      />
    </div>
  );
}
