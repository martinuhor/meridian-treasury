import type { Business, Invoice, User, YieldPosition } from "@prisma/client";
import type {
  LineItem,
  SerializedBusiness,
  SerializedInvoice,
  SerializedUser,
  SerializedYieldPosition,
} from "@/lib/types";

export function serializeUser(user: User): SerializedUser {
  return {
    id: user.id,
    privyUserId: user.privyUserId,
    email: user.email,
    walletAddress: user.walletAddress,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function serializeBusiness(business: Business): SerializedBusiness {
  return {
    id: business.id,
    userId: business.userId,
    name: business.name,
    contactEmail: business.contactEmail,
    country: business.country,
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };
}

export function serializeInvoice(
  invoice: Invoice & {
    business?: Business & { user?: Pick<User, "walletAddress" | "email"> };
  },
): SerializedInvoice {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    businessId: invoice.businessId,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    currency: invoice.currency,
    amount: invoice.amount.toString(),
    lineItems: invoice.lineItems as LineItem[],
    status: invoice.status,
    dueDate: invoice.dueDate.toISOString(),
    paidAt: invoice.paidAt?.toISOString() ?? null,
    txHash: invoice.txHash,
    payerAddress: invoice.payerAddress,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    business: invoice.business
      ? {
          ...serializeBusiness(invoice.business),
          user: invoice.business.user
            ? {
                walletAddress: invoice.business.user.walletAddress,
                email: invoice.business.user.email,
              }
            : undefined,
        }
      : undefined,
  };
}

/** Public checkout view: business name + payout wallet only (no owner email). */
export function serializePublicInvoice(
  invoice: Invoice & {
    business?: Business & { user?: Pick<User, "walletAddress" | "email"> };
  },
): SerializedInvoice {
  const full = serializeInvoice(invoice);
  if (full.business) {
    return {
      ...full,
      business: {
        ...full.business,
        contactEmail: "",
        user: full.business.user
          ? { walletAddress: full.business.user.walletAddress, email: "" }
          : undefined,
      },
    };
  }
  return full;
}

export function serializeYieldPosition(
  position: YieldPosition,
): SerializedYieldPosition {
  return {
    id: position.id,
    businessId: position.businessId,
    vaultAddress: position.vaultAddress,
    vaultName: position.vaultName,
    depositedPrincipal: position.depositedPrincipal.toString(),
    sharesHeld: position.sharesHeld.toString(),
    lastDepositTxHash: position.lastDepositTxHash,
    updatedAt: position.updatedAt.toISOString(),
  };
}
