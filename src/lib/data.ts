import { Prisma } from "@prisma/client";
import { isDemoSubject } from "@/lib/auth/subjects";
import { demoStore } from "@/lib/demo-store";
import { isDemoMode, prisma } from "@/lib/db";
import {
  serializeBusiness,
  serializeInvoice,
  serializePublicInvoice,
  serializeUser,
  serializeYieldPosition,
} from "@/lib/serializers";
import type { LineItem, OnboardingPayload } from "@/lib/types";
import { generateInvoiceNumber } from "@/lib/utils";
import { vaultAddress } from "@/lib/chain";
import { issuePaymentClaimToken } from "@/lib/payment-claim";

/**
 * Real DATABASE_URL → Prisma for non-demo subjects only.
 * Demo (`demo:`) subjects always use ephemeral memory so anonymous Try-demo
 * traffic cannot grow Postgres. Transient DB errors must surface.
 */
async function shouldUsePrisma(): Promise<boolean> {
  if (isDemoMode()) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Database unavailable: ${error.message}`
        : "Database unavailable.",
    );
  }
}

async function shouldUseDemoStoreForSubject(subject?: string | null) {
  if (isDemoSubject(subject)) return true;
  return !(await shouldUsePrisma());
}

async function shouldUseDemoStoreForBusiness(businessId: string) {
  if (demoStore.hasBusiness(businessId)) return true;
  return !(await shouldUsePrisma());
}

function redactPublic(invoice: NonNullable<ReturnType<typeof demoStore.getInvoice>>) {
  return {
    ...invoice,
    clientEmail: "",
    claimToken: issuePaymentClaimToken(invoice.id) ?? undefined,
    business: invoice.business
      ? {
          ...invoice.business,
          contactEmail: "",
          user: invoice.business.user
            ? {
                walletAddress: invoice.business.user.walletAddress,
                email: "",
              }
            : undefined,
        }
      : undefined,
  };
}

export async function getUserProfile(privyUserId: string) {
  if (await shouldUseDemoStoreForSubject(privyUserId)) {
    return demoStore.getUserByPrivyId(privyUserId);
  }
  const user = await prisma.user.findUnique({
    where: { privyUserId },
    include: { business: true },
  });
  if (!user) return null;
  return {
    ...serializeUser(user),
    business: user.business ? serializeBusiness(user.business) : null,
  };
}

export async function onboardUser(payload: OnboardingPayload) {
  if (await shouldUseDemoStoreForSubject(payload.privyUserId)) {
    return demoStore.onboard(payload);
  }

  const existing = await prisma.user.findUnique({
    where: { privyUserId: payload.privyUserId },
    include: { business: true },
  });
  if (existing?.business) {
    return {
      user: serializeUser(existing),
      business: serializeBusiness(existing.business),
      created: false as const,
    };
  }

  const user =
    existing ??
    (await prisma.user.create({
      data: {
        privyUserId: payload.privyUserId,
        email: payload.email,
        walletAddress: payload.walletAddress ?? null,
      },
    }));

  if (payload.walletAddress && user.walletAddress !== payload.walletAddress) {
    await prisma.user.update({
      where: { id: user.id },
      data: { walletAddress: payload.walletAddress },
    });
  }

  const business = await prisma.business.create({
    data: {
      userId: user.id,
      name: payload.businessName,
      contactEmail: payload.email,
      country: payload.country ?? "Nigeria",
    },
  });

  return {
    user: serializeUser(user),
    business: serializeBusiness(business),
    created: true as const,
  };
}

export async function syncWalletAddress(
  privyUserId: string,
  walletAddress: string,
) {
  if (await shouldUseDemoStoreForSubject(privyUserId)) {
    return demoStore.updateWallet(privyUserId, walletAddress);
  }
  const user = await prisma.user.update({
    where: { privyUserId },
    data: { walletAddress },
  });
  return serializeUser(user);
}

export async function listInvoicesForBusiness(businessId: string) {
  if (await shouldUseDemoStoreForBusiness(businessId)) {
    return demoStore.listInvoices(businessId);
  }
  const invoices = await prisma.invoice.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });
  return invoices.map(serializeInvoice);
}

export async function getInvoiceById(id: string) {
  const demo = demoStore.getInvoice(id);
  if (demo) return demo;

  if (!(await shouldUsePrisma())) return null;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      business: {
        include: {
          user: {
            select: { walletAddress: true, email: true },
          },
        },
      },
    },
  });
  return invoice ? serializeInvoice(invoice) : null;
}

export async function createInvoiceRecord(input: {
  businessId: string;
  clientName: string;
  clientEmail: string;
  dueDate: string;
  lineItems: LineItem[];
}) {
  const amount = input.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const amountFixed = amount.toFixed(6);

  if (await shouldUseDemoStoreForBusiness(input.businessId)) {
    const conflict = demoStore.findPendingSameAmount(
      input.businessId,
      amountFixed,
    );
    if (conflict) {
      throw new Error(
        "An unpaid invoice with this exact USDC amount already exists. Adjust the total so on-chain payments can be matched uniquely.",
      );
    }
    return demoStore.createInvoice(input);
  }

  const existingCount = await prisma.invoice.count({
    where: { businessId: input.businessId },
  });
  if (existingCount >= 500) {
    throw new Error("Invoice limit reached for this business.");
  }

  const duplicatePending = await prisma.invoice.findFirst({
    where: {
      businessId: input.businessId,
      status: "PENDING",
      amount: new Prisma.Decimal(amountFixed),
    },
    select: { id: true },
  });
  if (duplicatePending) {
    throw new Error(
      "An unpaid invoice with this exact USDC amount already exists. Adjust the total so on-chain payments can be matched uniquely.",
    );
  }

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: generateInvoiceNumber(),
      businessId: input.businessId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      amount: new Prisma.Decimal(amountFixed),
      lineItems: input.lineItems,
      dueDate: new Date(input.dueDate),
      status: "PENDING",
    },
  });
  return serializeInvoice(invoice);
}

export async function findInvoiceByTxHash(txHash: string) {
  const demo = demoStore.findByTxHash(txHash);
  if (demo) return demo;
  if (!(await shouldUsePrisma())) return null;
  const invoice = await prisma.invoice.findUnique({
    where: { txHash },
  });
  return invoice ? serializeInvoice(invoice) : null;
}

/**
 * True when another unpaid invoice shares the same business + exact amount
 * (so a raw USDC Transfer cannot be bound to a single invoice).
 */
export async function hasAmbiguousPendingAmount(invoice: {
  id: string;
  businessId: string;
  amount: string;
}) {
  if (await shouldUseDemoStoreForBusiness(invoice.businessId)) {
    return Boolean(
      demoStore.findPendingSameAmount(
        invoice.businessId,
        invoice.amount,
        invoice.id,
      ),
    );
  }

  const other = await prisma.invoice.findFirst({
    where: {
      businessId: invoice.businessId,
      status: "PENDING",
      amount: new Prisma.Decimal(Number(invoice.amount).toFixed(6)),
      NOT: { id: invoice.id },
    },
    select: { id: true },
  });
  return Boolean(other);
}

export async function markInvoicePaid(
  id: string,
  txHash: string,
  payerAddress: string,
) {
  if (demoStore.getInvoice(id)) {
    return demoStore.markPaid(id, txHash, payerAddress);
  }

  if (!(await shouldUsePrisma())) {
    return demoStore.markPaid(id, txHash, payerAddress);
  }

  const conflict = await prisma.invoice.findFirst({
    where: {
      txHash,
      NOT: { id },
    },
    select: { id: true },
  });
  if (conflict) {
    throw new Error("Transaction already used for another invoice");
  }

  try {
    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: "PAID",
        txHash,
        payerAddress,
        paidAt: new Date(),
      },
      include: {
        business: {
          include: {
            user: { select: { walletAddress: true, email: true } },
          },
        },
      },
    });
    return serializeInvoice(invoice);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Transaction already used for another invoice");
    }
    throw error;
  }
}

export async function getYieldPosition(businessId: string) {
  if (await shouldUseDemoStoreForBusiness(businessId)) {
    return demoStore.getYieldPosition(businessId);
  }
  const position = await prisma.yieldPosition.findFirst({
    where: { businessId },
  });
  return position ? serializeYieldPosition(position) : null;
}

export async function upsertYieldPosition(
  businessId: string,
  data: {
    depositedPrincipal: number;
    sharesHeld: number;
    lastDepositTxHash?: string | null;
  },
) {
  if (await shouldUseDemoStoreForBusiness(businessId)) {
    return demoStore.upsertYieldPosition(businessId, data);
  }

  const existing = await prisma.yieldPosition.findFirst({
    where: { businessId },
  });

  if (!existing) {
    const created = await prisma.yieldPosition.create({
      data: {
        businessId,
        vaultAddress,
        depositedPrincipal: new Prisma.Decimal(data.depositedPrincipal.toFixed(6)),
        sharesHeld: new Prisma.Decimal(data.sharesHeld.toFixed(18)),
        lastDepositTxHash: data.lastDepositTxHash ?? null,
      },
    });
    return serializeYieldPosition(created);
  }

  const updated = await prisma.yieldPosition.update({
    where: { id: existing.id },
    data: {
      depositedPrincipal: new Prisma.Decimal(data.depositedPrincipal.toFixed(6)),
      sharesHeld: new Prisma.Decimal(data.sharesHeld.toFixed(18)),
      lastDepositTxHash:
        data.lastDepositTxHash !== undefined
          ? data.lastDepositTxHash
          : existing.lastDepositTxHash,
    },
  });
  return serializeYieldPosition(updated);
}

/** Always ephemeral — never writes demo tenants into Postgres. */
export async function ensureDemoProfileForSubject(subject: string, email: string) {
  return demoStore.seedDemoBusinessFor(subject, email);
}

export async function getPublicInvoiceById(id: string) {
  const demo = demoStore.getInvoice(id);
  if (demo) return redactPublic(demo);

  if (!(await shouldUsePrisma())) return null;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      business: {
        include: {
          user: {
            select: { walletAddress: true, email: true },
          },
        },
      },
    },
  });
  if (!invoice) return null;
  const publicInvoice = serializePublicInvoice(invoice);
  return {
    ...publicInvoice,
    clientEmail: "",
    claimToken: issuePaymentClaimToken(publicInvoice.id) ?? undefined,
  };
}
