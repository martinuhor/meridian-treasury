import { randomUUID } from "crypto";
import type {
  LineItem,
  OnboardingPayload,
  SerializedBusiness,
  SerializedInvoice,
  SerializedUser,
  SerializedYieldPosition,
} from "@/lib/types";
import { generateInvoiceNumber } from "@/lib/utils";
import { vaultAddress } from "@/lib/chain";

type DemoState = {
  users: SerializedUser[];
  businesses: SerializedBusiness[];
  invoices: SerializedInvoice[];
  yieldPositions: SerializedYieldPosition[];
};

const globalStore = globalThis as unknown as {
  __meridianDemoStore?: DemoState;
};

function nowIso() {
  return new Date().toISOString();
}

function getStore(): DemoState {
  if (!globalStore.__meridianDemoStore) {
    globalStore.__meridianDemoStore = {
      users: [],
      businesses: [],
      invoices: [],
      yieldPositions: [],
    };
  }
  return globalStore.__meridianDemoStore;
}

export const demoStore = {
  hasBusiness(businessId: string) {
    return getStore().businesses.some((b) => b.id === businessId);
  },

  getUserByPrivyId(privyUserId: string) {
    const store = getStore();
    const user = store.users.find((u) => u.privyUserId === privyUserId);
    if (!user) return null;
    const business = store.businesses.find((b) => b.userId === user.id) ?? null;
    return { ...user, business };
  },

  findPendingSameAmount(businessId: string, amount: string, excludeId?: string) {
    const normalized = Number(amount).toFixed(6);
    return getStore().invoices.find(
      (i) =>
        i.businessId === businessId &&
        i.status === "PENDING" &&
        Number(i.amount).toFixed(6) === normalized &&
        i.id !== excludeId,
    );
  },

  onboard(payload: OnboardingPayload) {
    this.assertWithinCaps();
    const store = getStore();
    const existing = this.getUserByPrivyId(payload.privyUserId);
    if (existing?.business) {
      return {
        user: existing,
        business: existing.business,
        created: false as const,
      };
    }

    const ts = nowIso();
    const user: SerializedUser = {
      id: randomUUID(),
      privyUserId: payload.privyUserId,
      email: payload.email,
      walletAddress: payload.walletAddress ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
    const business: SerializedBusiness = {
      id: randomUUID(),
      userId: user.id,
      name: payload.businessName,
      contactEmail: payload.email,
      country: payload.country ?? "Nigeria",
      createdAt: ts,
      updatedAt: ts,
    };
    store.users.push(user);
    store.businesses.push(business);
    return { user, business, created: true as const };
  },

  updateWallet(privyUserId: string, walletAddress: string) {
    const store = getStore();
    const user = store.users.find((u) => u.privyUserId === privyUserId);
    if (!user) return null;
    user.walletAddress = walletAddress;
    user.updatedAt = nowIso();
    return user;
  },

  listInvoices(businessId: string) {
    return getStore()
      .invoices.filter((i) => i.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getInvoice(id: string) {
    const store = getStore();
    const invoice = store.invoices.find((i) => i.id === id);
    if (!invoice) return null;
    const business = store.businesses.find((b) => b.id === invoice.businessId);
    const user = business
      ? store.users.find((u) => u.id === business.userId)
      : undefined;
    return {
      ...invoice,
      business: business
        ? {
            ...business,
            user: user
              ? { walletAddress: user.walletAddress, email: user.email }
              : undefined,
          }
        : undefined,
    };
  },

  createInvoice(input: {
    businessId: string;
    clientName: string;
    clientEmail: string;
    dueDate: string;
    lineItems: LineItem[];
  }) {
    this.assertWithinCaps();
    const store = getStore();
    const forBusiness = store.invoices.filter(
      (i) => i.businessId === input.businessId,
    ).length;
    if (forBusiness >= 100) {
      throw new Error("Invoice limit reached for this business.");
    }
    const amount = input.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const ts = nowIso();
    const invoice: SerializedInvoice = {
      id: randomUUID(),
      invoiceNumber: generateInvoiceNumber(),
      businessId: input.businessId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      currency: "USDC",
      amount: amount.toFixed(6),
      lineItems: input.lineItems,
      status: "PENDING",
      dueDate: new Date(input.dueDate).toISOString(),
      paidAt: null,
      txHash: null,
      payerAddress: null,
      createdAt: ts,
      updatedAt: ts,
    };
    store.invoices.unshift(invoice);
    return invoice;
  },

  findByTxHash(txHash: string) {
    const store = getStore();
    const invoice = store.invoices.find(
      (i) => i.txHash?.toLowerCase() === txHash.toLowerCase(),
    );
    return invoice ? this.getInvoice(invoice.id) : null;
  },

  markPaid(id: string, txHash: string, payerAddress: string) {
    const store = getStore();
    const invoice = store.invoices.find((i) => i.id === id);
    if (!invoice) return null;
    if (invoice.status === "PAID") return invoice;
    const conflict = store.invoices.find(
      (i) => i.txHash?.toLowerCase() === txHash.toLowerCase() && i.id !== id,
    );
    if (conflict) {
      throw new Error("Transaction already used for another invoice");
    }
    invoice.status = "PAID";
    invoice.txHash = txHash;
    invoice.payerAddress = payerAddress;
    invoice.paidAt = nowIso();
    invoice.updatedAt = invoice.paidAt;
    return invoice;
  },

  /** Soft caps so anonymous demo traffic cannot grow without bound. */
  counts() {
    const store = getStore();
    return {
      users: store.users.length,
      businesses: store.businesses.length,
      invoices: store.invoices.length,
    };
  },

  /** Evict oldest demo tenants instead of blocking every visitor. */
  assertWithinCaps() {
    const store = getStore();
    while (store.users.length >= 200) {
      const oldest = store.users.shift();
      if (!oldest) break;
      const business = store.businesses.find((b) => b.userId === oldest.id);
      store.businesses = store.businesses.filter((b) => b.userId !== oldest.id);
      if (business) {
        store.invoices = store.invoices.filter(
          (i) => i.businessId !== business.id,
        );
        store.yieldPositions = store.yieldPositions.filter(
          (p) => p.businessId !== business.id,
        );
      }
    }
    while (store.invoices.length >= 2000) {
      store.invoices.pop();
    }
  },

  getYieldPosition(businessId: string) {
    return (
      getStore().yieldPositions.find((p) => p.businessId === businessId) ?? null
    );
  },

  upsertYieldPosition(
    businessId: string,
    data: {
      depositedPrincipal: number;
      sharesHeld: number;
      lastDepositTxHash?: string | null;
    },
  ) {
    const store = getStore();
    let position = store.yieldPositions.find((p) => p.businessId === businessId);
    const ts = nowIso();
    if (!position) {
      position = {
        id: randomUUID(),
        businessId,
        vaultAddress: vaultAddress,
        vaultName: "US Treasury & Institutional USDC Vault",
        depositedPrincipal: data.depositedPrincipal.toFixed(6),
        sharesHeld: data.sharesHeld.toFixed(18),
        lastDepositTxHash: data.lastDepositTxHash ?? null,
        updatedAt: ts,
      };
      store.yieldPositions.push(position);
    } else {
      position.depositedPrincipal = data.depositedPrincipal.toFixed(6);
      position.sharesHeld = data.sharesHeld.toFixed(18);
      if (data.lastDepositTxHash !== undefined) {
        position.lastDepositTxHash = data.lastDepositTxHash;
      }
      position.updatedAt = ts;
    }
    return position;
  },

  seedDemoBusinessFor(subject: string, email: string) {
    const existing = this.getUserByPrivyId(subject);
    if (existing?.business) return existing;
    const result = this.onboard({
      privyUserId: subject,
      email,
      walletAddress: "0xDemo000000000000000000000000000000000001",
      businessName: "Acme Export Co.",
      country: "Nigeria",
    });
    this.createInvoice({
      businessId: result.business.id,
      clientName: "Northwind Labs",
      clientEmail: "ap@northwind.example",
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      lineItems: [
        { description: "Q1 Engineering Retainer", quantity: 1, unitPrice: 4500 },
        { description: "API Integration Sprint", quantity: 1, unitPrice: 1800 },
      ],
    });
    this.createInvoice({
      businessId: result.business.id,
      clientName: "Harbor Logistics",
      clientEmail: "billing@harbor.example",
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      lineItems: [
        { description: "Freight Coordination Platform", quantity: 1, unitPrice: 3200 },
      ],
    });
    return this.getUserByPrivyId(subject);
  },
};
