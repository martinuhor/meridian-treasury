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
import { rateLimit, rateLimitPeek } from "@/lib/rate-limit";
import { visitorFingerprint } from "@/lib/request-ip";
import { publicActionError } from "@/lib/safe-error";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const MAX_BODY_BYTES = 1200;
const WINDOW_MS = 60 * 60 * 1000;
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

function tooMany(message: string, retryAfterSec: number) {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

/**
 * Public payment confirmation.
 * Requires: claim token from the pay page, the paying wallet address, and an
 * EIP-191 signature over invoice+tx from that wallet — then on-chain verify.
 *
 * Invoice/payer RPC budgets are consumed only immediately before chain verify
 * so cheap auth/idempotency failures cannot burn settlement capacity.
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

  const invoice = await getInvoiceById(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Cheap spam gate only — does not consume invoice RPC budget.
  const byVisitor = rateLimit(
    `confirm:fp:${visitorFingerprint(request.headers)}`,
    40,
    WINDOW_MS,
  );
  if (!byVisitor.ok) {
    return tooMany(
      "Too many confirmation attempts. Try again later.",
      byVisitor.retryAfterSec,
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

  const invoiceKey = `confirm:rpc:inv:${invoice.id}`;
  const payerKey = `confirm:rpc:payer:${body.payerAddress.toLowerCase()}`;

  // Peek first so we never consume then fail on the sibling bucket.
  const invPeek = rateLimitPeek(invoiceKey, 12, WINDOW_MS);
  if (!invPeek.ok) {
    return tooMany(
      "Too many confirmation attempts for this invoice.",
      invPeek.retryAfterSec,
    );
  }
  const payerPeek = rateLimitPeek(payerKey, 20, WINDOW_MS);
  if (!payerPeek.ok) {
    return tooMany(
      "Too many confirmation attempts from this wallet.",
      payerPeek.retryAfterSec,
    );
  }

  // Consume RPC budget only for the expensive on-chain verify.
  const byInvoice = rateLimit(invoiceKey, 12, WINDOW_MS);
  if (!byInvoice.ok) {
    return tooMany(
      "Too many confirmation attempts for this invoice.",
      byInvoice.retryAfterSec,
    );
  }
  const byPayer = rateLimit(payerKey, 20, WINDOW_MS);
  if (!byPayer.ok) {
    return tooMany(
      "Too many confirmation attempts from this wallet.",
      byPayer.retryAfterSec,
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
