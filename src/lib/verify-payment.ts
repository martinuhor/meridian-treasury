import {
  createPublicClient,
  decodeEventLog,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import {
  activeChain,
  erc20Abi,
  rpcUrl,
  usdcAddress,
} from "@/lib/chain";

export type PaymentVerificationResult =
  | {
      ok: true;
      payerAddress: Address;
      recipient: Address;
      amount: bigint;
    }
  | { ok: false; error: string };

export async function verifyUsdcTransfer(params: {
  txHash: Hex;
  expectedRecipient: Address;
  expectedAmountUsdc: string;
  /** ISO timestamp — reject transfers mined before the invoice existed. */
  invoiceCreatedAt: string;
  invoiceId: string;
  /** On-chain Transfer `from` must match this payer. */
  expectedPayer: Address;
}): Promise<PaymentVerificationResult> {
  if (!params.invoiceId || params.invoiceId.length > 128) {
    return { ok: false, error: "Invoice reference is invalid." };
  }
  if (!params.expectedPayer) {
    return { ok: false, error: "Payer address is required." };
  }
  const client = createPublicClient({
    chain: activeChain,
    transport: http(rpcUrl),
  });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: params.txHash });
  } catch {
    return { ok: false, error: "Transaction not found on the configured network." };
  }

  if (receipt.status !== "success") {
    return { ok: false, error: "Transaction failed on-chain." };
  }

  // Bind the payment to this invoice's lifetime (60s clock skew tolerance).
  const invoiceMs = Date.parse(params.invoiceCreatedAt);
  if (!Number.isFinite(invoiceMs)) {
    return { ok: false, error: "Invoice timestamp is invalid." };
  }
  try {
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    const txMs = Number(block.timestamp) * 1000;
    if (txMs + 60_000 < invoiceMs) {
      return {
        ok: false,
        error: "Transaction predates this invoice and cannot settle it.",
      };
    }
  } catch {
    return { ok: false, error: "Unable to verify transaction block timestamp." };
  }

  const expectedAmount = parseUnits(params.expectedAmountUsdc, 6);
  const expectedRecipient = params.expectedRecipient.toLowerCase();
  const expectedPayer = params.expectedPayer.toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdcAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") continue;
      const { from, to, value } = decoded.args as {
        from: Address;
        to: Address;
        value: bigint;
      };
      if (
        to.toLowerCase() === expectedRecipient &&
        from.toLowerCase() === expectedPayer &&
        value === expectedAmount
      ) {
        return {
          ok: true,
          payerAddress: from,
          recipient: to,
          amount: value,
        };
      }
    } catch {
      // skip non-matching logs
    }
  }

  return {
    ok: false,
    error:
      "No matching USDC transfer found for this payer, recipient, and amount.",
  };
}
