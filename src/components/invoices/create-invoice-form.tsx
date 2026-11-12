"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createInvoiceAction } from "@/app/actions/invoices";
import type { LineItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdc } from "@/lib/utils";

const emptyItem = (): LineItem => ({
  description: "",
  quantity: 1,
  unitPrice: 0,
});

export function CreateInvoiceForm() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);

  const total = useMemo(
    () =>
      lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [lineItems],
  );

  function updateItem(index: number, patch: Partial<LineItem>) {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createInvoiceAction({
      clientName,
      clientEmail,
      dueDate,
      lineItems,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const url = `${window.location.origin}/pay/${result.invoice.id}`;
    await navigator.clipboard.writeText(url).catch(() => undefined);
    toast.success("Invoice created — payment link copied");
    router.push("/dashboard");
  }

  return (
    <Card className="border-slate-200/80 bg-white/90">
      <CardHeader>
        <CardTitle className="font-display text-2xl">New payment link</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client name</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Client email</Label>
              <Input
                id="clientEmail"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2 sm:max-w-xs">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setLineItems((prev) => [...prev, emptyItem()])}
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </Button>
            </div>
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:grid-cols-[1.5fr_0.5fr_0.7fr_auto]"
              >
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) =>
                    updateItem(index, { description: e.target.value })
                  }
                  required
                />
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(index, { quantity: Number(e.target.value) })
                  }
                  required
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Rate (USDC)"
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateItem(index, { unitPrice: Number(e.target.value) })
                  }
                  required
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={lineItems.length === 1}
                  onClick={() =>
                    setLineItems((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 className="h-4 w-4 text-slate-500" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Total due{" "}
              <span className="font-mono text-lg font-semibold tabular-nums text-slate-900">
                ${formatUsdc(total)} USDC
              </span>
            </p>
            <Button type="submit" disabled={submitting || total <= 0}>
              {submitting ? "Creating…" : "Create invoice & copy link"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
