"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Download, ExternalLink } from "lucide-react";
import type { SerializedInvoice } from "@/lib/types";
import { usePayInvoice } from "@/hooks/use-pay-invoice";
import { explorerTxUrl } from "@/lib/chain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatUsdc, shortenAddress } from "@/lib/utils";
import { siteConfig } from "@/config/site";

export function Checkout({ initialInvoice }: { initialInvoice: SerializedInvoice }) {
  const [invoice, setInvoice] = useState(initialInvoice);
  const pay = usePayInvoice(invoice);

  useEffect(() => {
    if (
      pay.receipt.isSuccess &&
      pay.txHash &&
      !pay.confirmed &&
      invoice.status !== "PAID"
    ) {
      void pay.confirmOnBackend(pay.txHash).then((updated) => {
        // Confirm API returns a redacted public payload — merge onto local invoice.
        if (updated) setInvoice((prev) => ({ ...prev, ...updated }));
      });
    }
  }, [pay, invoice.status]);

  const paid = invoice.status === "PAID" || pay.confirmed;

  function printReceipt() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <p className="font-display text-2xl text-slate-900">{siteConfig.name}</p>
        <p className="mt-1 text-sm text-slate-500">Secure USDC payment checkout</p>
      </div>

      <Card className="border-slate-200/80 bg-white/95 print:shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="font-display text-2xl">
              {invoice.business?.name ?? "Business"}
            </CardTitle>
            <p className="mt-1 font-mono text-sm text-slate-500">
              {invoice.invoiceNumber}
            </p>
          </div>
          <Badge variant={paid ? "success" : "warning"}>
            {paid ? "PAID" : invoice.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Bill to</p>
              <p className="mt-1 font-medium text-slate-900">{invoice.clientName}</p>
              <p className="text-slate-500">{invoice.clientEmail}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Due date</p>
              <p className="mt-1 text-slate-900">
                {format(new Date(invoice.dueDate), "MMMM d, yyyy")}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Operating account {shortenAddress(invoice.business?.user?.walletAddress)}
              </p>
            </div>
          </div>

          <Separator />

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium">Qty</th>
                  <th className="pb-2 font-medium">Rate</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-2.5 text-slate-700">{item.description}</td>
                    <td className="py-2.5 font-mono tabular-nums">{item.quantity}</td>
                    <td className="py-2.5 font-mono tabular-nums">
                      ${formatUsdc(item.unitPrice)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums">
                      ${formatUsdc(item.quantity * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-500">Total due</span>
            <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
              ${formatUsdc(invoice.amount)} USDC
            </span>
          </div>

          {!paid ? (
            <div className="space-y-3 print:hidden">
              {!pay.isConnected ? (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={pay.connectWallet}
                  disabled={pay.isConnecting}
                >
                  Connect Wallet to Pay
                </Button>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => void pay.pay()}
                  disabled={pay.isWriting || pay.isSwitching || pay.isConfirmingApi}
                >
                  {pay.wrongNetwork
                    ? "Switch to Base & pay"
                    : pay.isWriting || pay.receipt.isLoading
                      ? "Confirming payment…"
                      : `Pay $${formatUsdc(invoice.amount)} USDC`}
                </Button>
              )}
              <p className="text-center text-xs text-slate-400">
                Supports MetaMask, Coinbase Wallet, and Rabby. Funds transfer
                peer-to-peer—Meridian never takes custody. Demo mark-as-paid is
                available only to the signed-in invoice owner from the dashboard.
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="font-medium text-emerald-800">Payment receipt</p>
              <p className="text-sm text-emerald-700">
                Paid {invoice.paidAt ? format(new Date(invoice.paidAt), "PPpp") : "just now"}
              </p>
              {invoice.txHash ? (
                <a
                  href={explorerTxUrl(invoice.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-emerald-800 underline"
                >
                  View on BaseScan <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <Button variant="outline" onClick={printReceipt} className="print:hidden">
                <Download className="h-4 w-4" />
                Download / print receipt
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
