"use client";

import { CreateInvoiceForm } from "@/components/invoices/create-invoice-form";

export default function NewInvoicePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-slate-900">
          Create invoice
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate a public USDC payment link for your client.
        </p>
      </div>
      <CreateInvoiceForm />
    </div>
  );
}
