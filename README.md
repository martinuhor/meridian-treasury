# Meridian — Treasury & Invoicing MVP

Non-custodial B2B USDC invoicing and treasury yield for emerging-market agencies and exporters. Built with Next.js (App Router), Privy smart wallets, Wagmi/Viem on Base, Prisma + PostgreSQL.

## Live app

**https://meridian-treasury.apps.grok.bot**

## Features

- Landing + demo / Privy onboarding with business profile
- Executive dashboard: operating balance, vault balance, projected yield, pending invoices
- Invoice creator with public payment links at `/pay/[invoiceId]`
- Wallet checkout (MetaMask / Coinbase / WalletConnect) with on-chain USDC verification
- Treasury vault sweep + 5-year yield projector (85% / 15% fee split)
- Local demo mode when `DEMO_MODE=true` (or no database in development)

## Stack

- Next.js 15 + TypeScript + Tailwind + shadcn/ui
- Privy + Wagmi v2 + Viem
- Prisma → PostgreSQL
- Cursor app hosting (`cursor-app.json` Postgres) and optional Netlify

## Setup

1. Copy env template and fill values:

```bash
cp .env.example .env
```

2. Set `DATABASE_URL` (Postgres) and `SESSION_SECRET` (`openssl rand -hex 32`).

3. Push schema:

```bash
npm install
npx prisma db push
```

4. Optional: configure Privy (`NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`) with Base Sepolia or Base Mainnet.

5. Run locally:

```bash
npm run dev
```

App defaults to [http://localhost:3456](http://localhost:3456).

Without a database in development, or with `DEMO_MODE=true`, the app uses an in-memory demo store so you can explore the UI.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port 3456 |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run db:push` | Push Prisma schema |
| `npm run db:migrate` | Create/apply migrations |

## Deploy

Published on Cursor at **https://meridian-treasury.apps.grok.bot**. Bind `SESSION_SECRET`, and optionally `PRIVY_APP_SECRET` / `PROTOCOL_TREASURY_ADDRESS`, in app secrets.

For Netlify: connect the repo, set env vars from `.env.example`, build with `npm run build` (`netlify.toml`).

## Branding

Update product name and copy in `src/config/site.ts`.
