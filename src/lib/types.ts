export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type SerializedUser = {
  id: string;
  privyUserId: string;
  email: string;
  walletAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedBusiness = {
  id: string;
  userId: string;
  name: string;
  contactEmail: string;
  country: string;
  createdAt: string;
  updatedAt: string;
};

export type SerializedInvoice = {
  id: string;
  invoiceNumber: string;
  businessId: string;
  clientName: string;
  clientEmail: string;
  currency: string;
  amount: string;
  lineItems: LineItem[];
  status: InvoiceStatus;
  dueDate: string;
  paidAt: string | null;
  txHash: string | null;
  payerAddress: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present only on the public pay page — HMAC claim for confirm. */
  claimToken?: string;
  business?: SerializedBusiness & {
    user?: Pick<SerializedUser, "walletAddress" | "email">;
  };
};

export type SerializedYieldPosition = {
  id: string;
  businessId: string;
  vaultAddress: string;
  vaultName: string;
  depositedPrincipal: string;
  sharesHeld: string;
  lastDepositTxHash: string | null;
  updatedAt: string;
};

export type OnboardingPayload = {
  privyUserId: string;
  email: string;
  walletAddress?: string | null;
  businessName: string;
  country?: string;
};
