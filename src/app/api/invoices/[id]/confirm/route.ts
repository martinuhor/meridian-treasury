import { NextResponse } from "next/server";
import type { Hex, Address } from "viem";
import {
  findInvoiceByTxHash,
  getInvoiceById,
  hasAmbiguousPendingAmount,
  markInvoicePaid,
} from "@/lib/data";
import { verifyPaymentClaimToken } from "@/lib/payment-claim";
import { verifyPaymentConfirmSignature } from "@/lib/payment-intent";
import { verifyUsdcTransfer } from "@/lib/verify-payment";
import { rateLimit } from "@/lib/rate-limit";
import { visitorFingerprint } from "@/lib/request-ip";
import { publicActionError } from "@/lib/safe-error";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const MAX_BODY_BYTES = 1200;
/** Prisma cuid / uuid-ish ids only — reject garbage before any side effects. */
const INVOICE_ID_RE = /^[a-z0-9][a-z0-9_-]{7,63}$/i;

/** Minimal public confirmation payload — no owner/client PII or line items. */
function publicConfirmInvoice(invoice: {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: string;
  currency: string;
  txHash: string | null;
  paidAt: string | null;
  payerAddress: string | null;
}) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    amount: invoice.amount,
    currency: invoice.currency,
    txHash: invoice.txHash,
    paidAt: invoice.paidAt,
    payerAddress: invoice.payerAddress,
  };
}

/**
 * Public payment confirmation.
 * Requires: claim token from the pay page, the paying wallet address, and an
 * EIP-191 signature over invoice+tx from that wallet — then on-chain verify.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  if (!id || !INVOICE_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  let body: {
    txHash?: string;
    claimToken?: string;
    payerAddress?: string;
    signature?: string;
  } | null = null;
  try {
    body = JSON.parse(raw) as {
      txHash?: string;
      claimToken?: string;
      payerAddress?: string;
      signature?: string;
    };
  } catch {
    body = null;
  }

  if (!body?.txHash || typeof body.txHash !== "string") {
    return NextResponse.json({ error: "txHash is required" }, { status: 400 });
  }
  if (body.txHash.startsWith("0xdemo") || body.txHash.length !== 66) {
    return NextResponse.json(
      { error: "Invalid transaction hash." },
      { status: 400 },
    );
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) {
    return NextResponse.json(
      { error: "Invalid transaction hash." },
      { status: 400 },
    );
  }
  if (
    !body.payerAddress ||
    typeof body.payerAddress !== "string" ||
    !/^0x[a-fA-F0-9]{40}$/.test(body.payerAddress)
  ) {
    return NextResponse.json(
      { error: "payerAddress is required." },
      { status: 400 },
    );
  }
  if (!verifyPaymentClaimToken(id, body.claimToken)) {
    return NextResponse.json(
      { error: "Invalid or expired payment claim." },
      { status: 403 },
    );
  }

  const signed = await verifyPaymentConfirmSignature({
    invoiceId: id,
    txHash: body.txHash,
    payerAddress: body.payerAddress as Address,
    signature: body.signature ?? "",
  });
  if (!signed) {
    return NextResponse.json(
      { error: "Payment confirmation signature is invalid." },
      { status: 403 },
    );
  }

  // Resolve invoice before creating any per-invoice rate-limit keys.
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Throttle after authz. Keys are stable (invoice / payer / visitor) — never
  // the claim token, which can be reissued and would bypass the bucket.
  const byInvoice = rateLimit(`confirm:inv:${invoice.id}`, 12, 60 * 60 * 1000);
  if (!byInvoice.ok) {
    return NextResponse.json(
      { error: "Too many confirmation attempts for this invoice." },
      {
        status: 429,
        headers: { "Retry-After": String(byInvoice.retryAfterSec) },
      },
    );
  }
  const byPayer = rateLimit(
    `confirm:payer:${body.payerAddress.toLowerCase()}`,
    20,
    60 * 60 * 1000,
  );
  if (!byPayer.ok) {
    return NextResponse.json(
      { error: "Too many confirmation attempts from this wallet." },
      {
        status: 429,
        headers: { "Retry-After": String(byPayer.retryAfterSec) },
      },
    );
  }
  const byVisitor = rateLimit(
    `confirm:fp:${visitorFingerprint(request.headers)}`,
    30,
    60 * 60 * 1000,
  );
  if (!byVisitor.ok) {
    return NextResponse.json(
      { error: "Too many confirmation attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(byVisitor.retryAfterSec) },
      },
    );
  }

  if (invoice.status === "PAID") {
    const sameTx =
      invoice.txHash?.toLowerCase() === body.txHash.toLowerCase();
    return NextResponse.json({
      invoice: publicConfirmInvoice(invoice),
      alreadyPaid: true,
      matched: sameTx,
    });
  }

  const existing = await findInvoiceByTxHash(body.txHash);
  if (existing && existing.id !== invoice.id) {
    return NextResponse.json(
      { error: "This transaction already settled a different invoice." },
      { status: 409 },
    );
  }

  if (await hasAmbiguousPendingAmount(invoice)) {
    return NextResponse.json(
      {
        error:
          "Multiple unpaid invoices share this USDC amount; payment cannot be matched uniquely.",
      },
      { status: 409 },
    );
  }

  const recipient = invoice.business?.user?.walletAddress as Address | undefined;
  if (!recipient || recipient.startsWith("0xDemo")) {
    return NextResponse.json(
      {
        error:
          "Business operating account is not configured for live settlement.",
      },
      { status: 400 },
    );
  }

  const verification = await verifyUsdcTransfer({
    txHash: body.txHash as Hex,
    expectedRecipient: recipient,
    expectedAmountUsdc: invoice.amount,
    invoiceCreatedAt: invoice.createdAt,
    invoiceId: invoice.id,
    expectedPayer: body.payerAddress as Address,
  });

  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: 400 });
  }

  try {
    const updated = await markInvoicePaid(
      invoice.id,
      body.txHash,
      verification.payerAddress,
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Unable to mark invoice paid." },
        { status: 400 },
      );
    }
    return NextResponse.json({ invoice: publicConfirmInvoice(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: publicActionError(error, "Unable to mark paid") },
      { status: 400 },
    );
  }
}
