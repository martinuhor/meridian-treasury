"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";

export function usePrivyAuthLive() {
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();
  const { wallets } = useWallets();
  const embedded = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress =
    embedded?.address ?? user?.wallet?.address ?? wallets[0]?.address ?? null;

  return {
    ready,
    authenticated,
    user,
    login,
    logout,
    walletAddress,
    getAccessToken,
  };
}
