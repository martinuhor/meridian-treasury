export const siteConfig = {
  name: "Meridian",
  tagline: "Institutional USDC invoicing & treasury yield",
  description:
    "Issue professional USD payment links, receive USDC into your self-custodied operating account, and sweep idle balances into audited Treasury vaults—keeping 85% of the yield.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3456",
  userYieldShare: 0.85,
  platformFeeShare: 0.15,
  defaultNetApy: 0.0485,
  grossApy: 0.057,
  supportEmail: "hello@meridian.finance",
  networkLabel: {
    8453: "Base",
    84532: "Base Sepolia",
  } as Record<number, string>,
};
