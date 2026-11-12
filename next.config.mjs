import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { webpack } = require("next/dist/compiled/webpack/webpack");
const stub = path.join(__dirname, "src/lib/stubs/empty-module.js");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@privy-io/react-auth", "@privy-io/wagmi"],
  serverExternalPackages: ["@prisma/client", "prisma"],
  webpack: (config) => {
    config.externals.push("pino-pretty", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/evm": stub,
      "@x402/evm/upto/client": stub,
      "@x402/evm/exact/client": stub,
      "@x402/core/client": stub,
      "@x402/svm/exact/client": stub,
      "@x402/svm": stub,
      "@solana-program/system": stub,
      "@solana-program/token": stub,
      "@solana/kit": stub,
      "@solana/web3.js": stub,
      "@farcaster/mini-app-solana": stub,
    };
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /FundSolWalletWithExternalSolanaWallet/,
      }),
    );
    return config;
  },
};

export default nextConfig;
