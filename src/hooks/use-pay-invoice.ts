"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { toast } from "sonner";
import { activeChain, chainId, rpcUrl } from "@/lib/chain";
import {
  connectBrowserWallet,
  getConnectedAddress,
  signPaymentConfirm,
  transferUsdc,
} from "@/lib/browser-wallet";
import type { SerializedInvoice } from "@/lib/types";

export function usePayInvoice(invoice: SerializedInvoice | null) {
  const [address, setAddress] = useState<Address | null>(null);
  const [txHash, setTxHash] = useState<Hex | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isConfirmingApi, setIsConfirmingApi] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [receiptSuccess, setReceiptSuccess] = useState(false);

  const recipient = invoice?.business?.user?.walletAddress as
    | Address
    | undefined;

  useEffect(() => {
    void getConnectedAddress().then((addr) => {
      if (addr) setAddress(addr);
    });
  }, []);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    try {
      const addr = await connectBrowserWallet();
      setAddress(addr);
      toast.success("Wallet connected");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to connect wallet",
      );
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const pay = useCallback(async () => {
    if (!invoice || !recipient) {
      toast.error("Operating account unavailable for this invoice.");
      return;
    }
    if (recipient.startsWith("0xDemo")) {
      toast.error(
        "This business is still using a demo operating account. Live USDC payment is unavailable.",
      );
      return;
    }
    try {
      setIsWriting(true);
      let account = address;
      if (!account) {
        account = await connectBrowserWallet();
        setAddress(account);
      }
      const amount = parseUnits(invoice.amount, 6);
      const hash = await transferUsdc({
        to: recipient,
        amountWei: amount,
        account,
      });
      setTxHash(hash);
      toast.message("Payment submitted", {
        description: "Waiting for network confirmation…",
      });
      setIsWaiting(true);
      const publicClient = createPublicClient({
        chain: activeChain,
        transport: http(rpcUrl),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setReceiptSuccess(true);
      setIsWaiting(false);
      return hash;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Payment could not be sent.",
      );
    } finally {
      setIsWriting(false);
      setIsWaiting(false);
    }
  }, [address, invoice, recipient]);

  const confirmOnBackend = useCallback(
    async (hash: Hex) => {
      if (!invoice) return null;
      setIsConfirmingApi(true);
      try {
        if (!address) {
          throw new Error("Connect the paying wallet before confirming.");
        }
        if (!invoice.claimToken) {
          throw new Error("Missing payment claim. Refresh the checkout page.");
        }
        const signature = await signPaymentConfirm({
          account: address,
          invoiceId: invoice.id,
          txHash: hash,
        });
        const res = await fetch(`/api/invoices/${invoice.id}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: hash,
            claimToken: invoice.claimToken,
            payerAddress: address,
            signature,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Confirmation failed");
        }
        setConfirmed(true);
        toast.success("Payment confirmed");
        return data.invoice as Partial<SerializedInvoice> &
          Pick<SerializedInvoice, "id" | "status">;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Unable to confirm payment",
        );
        return null;
      } finally {
        setIsConfirmingApi(false);
      }
    },
    [invoice, address],
  );

  return {
    address,
    isConnected: Boolean(address),
    wrongNetwork: false,
    connectWallet: () => void connectWallet(),
    isConnecting,
    isSwitching: false,
    pay,
    txHash,
    receipt: {
      isSuccess: receiptSuccess,
      isLoading: isWaiting,
    },
    confirmOnBackend,
    isWriting,
    isConfirmingApi,
    confirmed,
    recipient,
    chainId,
  };
}
