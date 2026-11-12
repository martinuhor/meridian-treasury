"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { formatUnits, type Address } from "viem";
import {
  erc4626Abi,
  isVaultConfigured,
  vaultAddress,
} from "@/lib/chain";
import { siteConfig } from "@/config/site";

export function useVaultPosition(
  address?: string | null,
  demoAssets = 8200,
) {
  const configured = isVaultConfigured();
  const enabled = Boolean(configured && address && !address.startsWith("0xDemo"));

  const sharesQuery = useReadContract({
    address: vaultAddress,
    abi: erc4626Abi,
    functionName: "balanceOf",
    args: address && enabled ? [address as Address] : undefined,
    query: { enabled },
  });

  const assetsQuery = useReadContract({
    address: vaultAddress,
    abi: erc4626Abi,
    functionName: "convertToAssets",
    args:
      enabled && sharesQuery.data !== undefined
        ? [sharesQuery.data as bigint]
        : undefined,
    query: { enabled: enabled && sharesQuery.data !== undefined },
  });

  const assets = useMemo(() => {
    if (!enabled) return demoAssets;
    if (assetsQuery.data === undefined) return 0;
    return Number(formatUnits(assetsQuery.data as bigint, 6));
  }, [assetsQuery.data, demoAssets, enabled]);

  const projectedAnnualYield = assets * siteConfig.defaultNetApy;

  return {
    assets,
    shares: enabled
      ? Number(
          formatUnits(
            (sharesQuery.data as bigint | undefined) ?? BigInt(0),
            18,
          ),
        )
      : demoAssets,
    projectedAnnualYield,
    netApy: siteConfig.defaultNetApy,
    isLoading: enabled ? sharesQuery.isLoading || assetsQuery.isLoading : false,
    isError: sharesQuery.isError || assetsQuery.isError,
    refetch: async () => {
      await sharesQuery.refetch();
      await assetsQuery.refetch();
    },
    isDemo: !enabled,
    vaultConfigured: configured,
  };
}
