import { base, baseSepolia } from "viem/chains";
import type { Address, Chain, Hex } from "viem";

export const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");

export const activeChain: Chain = chainId === 8453 ? base : baseSepolia;

export const rpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL ??
  (chainId === 8453 ? "https://mainnet.base.org" : "https://sepolia.base.org");

export const usdcAddress = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as Address;

export const vaultAddress = (process.env.NEXT_PUBLIC_VAULT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as Address;

export const protocolTreasuryAddress = (process.env
  .PROTOCOL_TREASURY_ADDRESS ??
  "0x0000000000000000000000000000000000000001") as Address;

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

export function isVaultConfigured() {
  return vaultAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase();
}

export function explorerTxUrl(txHash: Hex | string) {
  const baseUrl =
    chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org";
  return `${baseUrl}/tx/${txHash}`;
}

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export const erc4626Abi = [
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
] as const;
