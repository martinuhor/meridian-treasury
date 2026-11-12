"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { InvoiceStatus, SerializedInvoice } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUsdc } from "@/lib/utils";
import { simulateInvoicePaymentAction } from "@/app/actions/invoices";

const statusVariant: Record<
  InvoiceStatus,
  "secondary" | "success" | "warning" | "danger" | "outline"
> = {
  DRAFT: "outline",
  PENDING: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "secondary",
};

export function InvoicesTable({
  invoices,
  onUpdated,
}: {
  invoices: SerializedInvoice[];
  onUpdated?: (invoice: SerializedInvoice) => void;
}) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.status.toLowerCase().includes(q),
    );
  }, [invoices, query]);

  async function copyLink(id: string) {
    const url = `${window.location.origin}/pay/${id}`;
    await navigator.clipboard.writeText(url);
    setCopied(id);
    toast.success("Payment link copied");
    setTimeout(() => setCopied(null), 1500);
  }

  async function markDemoPaid(id: string) {
    setSimulating(id);
    const result = await simulateInvoicePaymentAction(id);
    setSimulating(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Marked paid (demo)");
    if (result.invoice) onUpdated?.(result.invoice);
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/90">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Recent invoices</h2>
          <p className="text-sm text-slate-500">Filter by client, number, or status</p>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search invoices…"
          className="sm:max-w-xs"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice #</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No invoices yet. Create a payment link to get started.
                </td>
              </tr>
            ) : (
              filtered.map((invoice) => (
                <tr key={invoice.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-slate-800">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{invoice.clientName}</td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-900">
                    ${formatUsdc(invoice.amount)} USDC
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[invoice.status]}>
                      {invoice.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void copyLink(invoice.id)}
                      >
                        {copied === invoice.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        Copy
                      </Button>
                      {invoice.status === "PENDING" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={simulating === invoice.id}
                          onClick={() => void markDemoPaid(invoice.id)}
                        >
                          {simulating === invoice.id ? "…" : "Mark paid (demo)"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
