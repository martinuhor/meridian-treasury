"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { formatUnits, type Address } from "viem";
import { erc20Abi, usdcAddress } from "@/lib/chain";

export function useUsdcBalance(address?: string | null, demoBalance = 12450.5) {
  const enabled = Boolean(address && !address.startsWith("0xDemo"));

  const { data, isLoading, isError, refetch, error } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address && enabled ? [address as Address] : undefined,
    query: { enabled },
  });

  const balance = useMemo(() => {
    if (!enabled) return demoBalance;
    if (data === undefined) return 0;
    return Number(formatUnits(data as bigint, 6));
  }, [data, demoBalance, enabled]);

  return {
    balance,
    isLoading: enabled ? isLoading : false,
    isError,
    error,
    refetch,
    isDemo: !enabled,
  };
}
