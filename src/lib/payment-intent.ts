import { verifyMessage, type Address, type Hex } from "viem";

/** Canonical message the paying wallet must sign to confirm an invoice. */
export function paymentConfirmMessage(invoiceId: string, txHash: string) {
  return [
    "Meridian payment confirmation",
    `invoice:${invoiceId}`,
    `tx:${txHash.toLowerCase()}`,
  ].join("\n");
}

export async function verifyPaymentConfirmSignature(params: {
  invoiceId: string;
  txHash: string;
  payerAddress: Address;
  signature: string;
}): Promise<boolean> {
  if (
    !params.signature ||
    typeof params.signature !== "string" ||
    params.signature.length > 200 ||
    !/^0x[a-fA-F0-9]+$/.test(params.signature)
  ) {
    return false;
  }
  try {
    return await verifyMessage({
      address: params.payerAddress,
      message: paymentConfirmMessage(params.invoiceId, params.txHash),
      signature: params.signature as Hex,
    });
  } catch {
    return false;
  }
}
