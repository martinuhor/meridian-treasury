"use client";

import {
  createWalletClient,
  custom,
  type Address,
  type Hex,
} from "viem";
import { activeChain, chainId, erc20Abi, usdcAddress } from "@/lib/chain";

type EthereumProvider = {
  request: (args: {
    method: string;
    params?: unknown[] | object;
  }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function getProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { ethereum?: EthereumProvider }).ethereum ?? null
  );
}

export async function connectBrowserWallet(): Promise<Address> {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      "No browser wallet found. Install MetaMask, Coinbase Wallet, or Rabby.",
    );
  }
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as Address[];
  if (!accounts[0]) throw new Error("Wallet connection was cancelled.");

  const current = Number(
    (await provider.request({ method: "eth_chainId" })) as string,
  );
  if (current !== chainId) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${chainId.toString(16)}`,
            chainName: activeChain.name,
            nativeCurrency: activeChain.nativeCurrency,
            rpcUrls: [activeChain.rpcUrls.default.http[0]],
            blockExplorerUrls: activeChain.blockExplorers
              ? [activeChain.blockExplorers.default.url]
              : [],
          },
        ],
      });
    }
  }

  return accounts[0];
}

export async function transferUsdc(params: {
  to: Address;
  amountWei: bigint;
  account: Address;
}): Promise<Hex> {
  const provider = getProvider();
  if (!provider) throw new Error("No browser wallet found.");

  const client = createWalletClient({
    account: params.account,
    chain: activeChain,
    transport: custom(provider),
  });

  return client.writeContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [params.to, params.amountWei],
    account: params.account,
    chain: activeChain,
  });
}

export async function getConnectedAddress(): Promise<Address | null> {
  const provider = getProvider();
  if (!provider) return null;
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as Address[];
  return accounts[0] ?? null;
}

export async function signPaymentConfirm(params: {
  account: Address;
  invoiceId: string;
  txHash: Hex;
}): Promise<Hex> {
  const provider = getProvider();
  if (!provider) throw new Error("No browser wallet found.");

  const client = createWalletClient({
    account: params.account,
    chain: activeChain,
    transport: custom(provider),
  });

  const message = [
    "Meridian payment confirmation",
    `invoice:${params.invoiceId}`,
    `tx:${params.txHash.toLowerCase()}`,
  ].join("\n");

  return client.signMessage({
    account: params.account,
    message,
  });
}
