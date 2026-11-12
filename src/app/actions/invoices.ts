"use server";

import { z } from "zod";
import {
  createInvoiceRecord,
  getInvoiceById,
  listInvoicesForBusiness,
  markInvoicePaid,
} from "@/lib/data";
import { requireOwnedBusiness } from "@/lib/auth/session";
import { isDemoSubject } from "@/lib/auth/subjects";
import { isDemoMode } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { rateLimitKey } from "@/lib/request-ip";
import { publicActionError } from "@/lib/safe-error";

const lineItemSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().positive().max(1_000_000),
  unitPrice: z.number().nonnegative().max(1_000_000_000),
});

const createSchema = z.object({
  clientName: z.string().min(1).max(120),
  clientEmail: z.string().email().max(254),
  dueDate: z.string().min(1).max(40),
  lineItems: z.array(lineItemSchema).min(1).max(40),
});

export async function createInvoiceAction(input: unknown) {
  const owned = await requireOwnedBusiness();
  if (!owned.ok) return { ok: false as const, error: owned.error };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Please complete all invoice fields." };
  }
  const total = parsed.data.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  if (total <= 0) {
    return { ok: false as const, error: "Invoice total must be greater than zero." };
  }

  const key = await rateLimitKey(
    `invoice-create:${owned.profile.business.id}`,
  );
  const limited = rateLimit(key, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return {
      ok: false as const,
      error: `Invoice creation limit reached. Retry in ${limited.retryAfterSec}s.`,
    };
  }

  try {
    // Demo-owned businesses stay in memory via the data layer.
    const invoice = await createInvoiceRecord({
      businessId: owned.profile.business.id,
      ...parsed.data,
    });
    return { ok: true as const, invoice };
  } catch (error) {
    console.error(error);
    return {
      ok: false as const,
      error: publicActionError(error, "Unable to create invoice."),
    };
  }
}

export async function listInvoicesAction() {
  const owned = await requireOwnedBusiness();
  if (!owned.ok) return { invoices: [], error: owned.error };
  const invoices = await listInvoicesForBusiness(owned.profile.business.id);
  return { invoices };
}

/** Owner-only full invoice fetch. */
export async function getInvoiceAction(id: string) {
  const owned = await requireOwnedBusiness();
  if (!owned.ok) return { invoice: null, error: owned.error };
  if (!id || id.length > 128) return { invoice: null };
  const invoice = await getInvoiceById(id);
  if (!invoice || invoice.businessId !== owned.profile.business.id) {
    return { invoice: null, error: "Invoice not found." };
  }
  return { invoice };
}

/**
 * Owner-only demo mark-paid. Never available on the public confirm API.
 * Allowed for demo subjects (ephemeral store) or when DEMO_MODE is on.
 */
export async function simulateInvoicePaymentAction(invoiceId: string) {
  const owned = await requireOwnedBusiness();
  if (!owned.ok) return { ok: false as const, error: owned.error };

  const demoOk =
    isDemoSubject(owned.session.subject) || isDemoMode();
  if (!demoOk) {
    return {
      ok: false as const,
      error: "Demo payments are only available in the demo experience.",
    };
  }

  if (!invoiceId || invoiceId.length > 128) {
    return { ok: false as const, error: "Invoice not found." };
  }

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice || invoice.businessId !== owned.profile.business.id) {
    return { ok: false as const, error: "Invoice not found." };
  }
  if (invoice.status === "PAID") {
    return { ok: true as const, invoice };
  }

  const txHash = `0xdemo${Date.now().toString(16).padStart(56, "0")}`;
  const payer = "0xDemoPayer000000000000000000000000000001";
  try {
    const updated = await markInvoicePaid(invoiceId, txHash, payer);
    return { ok: true as const, invoice: updated };
  } catch (error) {
    return {
      ok: false as const,
      error: publicActionError(error, "Unable to simulate payment"),
    };
  }
}
