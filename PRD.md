# Product Requirements Document (PRD): Meridian Treasury & Invoicing MVP

## 1. Executive Summary & Product Vision
* **Product Name:** Meridian (Placeholder — update branding in `src/config/site.ts`)
* **Target Audience:** Emerging-market agencies, remote software contractors, and B2B exporters (initial wedge: Nigeria & Africa) who bill international clients in USD/USDC.
* **Core Value Proposition:** A non-custodial, institutional-grade B2B stablecoin invoicing and automated treasury yield platform. Businesses issue professional USD payment links, receive USDC/USDT directly into a self-custodied smart wallet without managing seed phrases, and automatically sweep idle balances into audited USD Treasury yield vaults—retaining 85% of the yield while the platform takes a 15% automated performance fee.
* **Deployment Target:** Netlify (Next.js App Router + Node.js Serverless Runtime) backed by Supabase (PostgreSQL). **Do not use local SQLite.**

---

## 2. Non-Negotiable Architectural & Security Boundaries
1. **Zero Custody (Non-Custodial by Design):** The platform NEVER holds user private keys, never pools user funds in a company wallet, and never touches local fiat bank rails directly. All funds move peer-to-peer between the client's wallet, the business's Privy ERC-4337 smart account, and audited on-chain ERC-4626 yield vaults.
2. **Institutional Fintech UX:** No "degen" crypto jargon. Avoid words like "gas," "seed phrase," "slippage," or "farming" in user-facing UI. Use terms like *"Operating Account," "Treasury Vault," "Payment Link,"* and *"Annualized Yield."*
3. **Network:** Base Mainnet (`Chain ID: 8453`) for production and Base Sepolia (`Chain ID: 84532`) for development/testing.
4. **Primary Assets:** USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` on Base Mainnet; mock ERC-20 USDC on Base Sepolia).

---

## 3. Tech Stack Specification
* **Framework:** Next.js 14/15 (App Router, TypeScript, Server Actions)
* **Styling & UI:** Tailwind CSS + Shadcn UI + Lucide Icons (Mercury Bank / Stripe aesthetic: crisp white/slate surfaces, subtle borders, tabular numerals)
* **Auth & Embedded Wallets:** Privy (`@privy-io/react-auth` + `@privy-io/wagmi`) configured with Email/Google login and automatic ERC-4337 Smart Wallet creation on Base.
* **Web3 Client Interaction:** Wagmi v2 + Viem v2 (for public checkout payer connections and on-chain USDC / ERC-4626 read/write calls).
* **Database & ORM:** Supabase (PostgreSQL) accessed via Prisma ORM (`@prisma/client`).
* **Hosting:** Netlify (`@netlify/plugin-nextjs` compatible; all dynamic routes compatible with serverless Node.js functions).

---

## 4. Database Schema (`prisma/schema.prisma`)
Cursor Agent must generate and migrate the following schema for PostgreSQL:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id            String    @id @default(cuid())
  privyUserId   String    @unique
  email         String    @unique
  walletAddress String?   @unique
  business      Business?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Business {
  id              String          @id @default(cuid())
  userId          String          @unique
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  name            String
  contactEmail    String
  country         String          @default("Nigeria")
  invoices        Invoice[]
  yieldPositions  YieldPosition[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

enum InvoiceStatus {
  DRAFT
  PENDING
  PAID
  OVERDUE
  CANCELLED
}

model Invoice {
  id            String        @id @default(cuid())
  invoiceNumber String        @unique
  businessId    String
  business      Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  clientName    String
  clientEmail   String
  currency      String        @default("USDC")
  amount        Decimal       @db.Decimal(18, 6)
  lineItems     Json          // Array of { description: string, quantity: number, unitPrice: number }
  status        InvoiceStatus @default(PENDING)
  dueDate       DateTime
  paidAt        DateTime?
  txHash        String?       @unique
  payerAddress  String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

model YieldPosition {
  id                String   @id @default(cuid())
  businessId        String
  business          Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  vaultAddress      String
  vaultName         String   @default("US Treasury & Institutional USDC Vault")
  depositedPrincipal Decimal @db.Decimal(18, 6)
  sharesHeld        Decimal  @db.Decimal(36, 18)
  lastDepositTxHash String?
  updatedAt         DateTime @updatedAt
}

```

---

## 5. Functional Requirements & User Flows

### Feature 1: Onboarding & Smart Account Provisioning (`/`)

* **Landing Page:** Clean B2B landing page with a "Get Started / Sign In" CTA powered by Privy.
* **First-Time Flow:** When a user authenticates via email/Google, Privy automatically creates an embedded smart wallet on Base. A Server Action checks if a `User` record exists; if not, it prompts for **Business Name** and creates both `User` and `Business` records in Postgres.

### Feature 2: Executive Treasury Dashboard (`/dashboard`)

* **Top Metric Cards:**
1. **Operating Balance (Idle USDC):** Live on-chain `balanceOf` read for the business's smart wallet.
2. **Treasury Vault Balance (Earning Yield):** Live value of user's ERC-4626 vault shares converted to USDC (`convertToAssets`).
3. **Projected Annual Yield (Net 85%):** Calculated dynamically based on current vault APY (default fallback `4.85%` net APY if testnet vault has 0% rate).
4. **Pending Invoices:** Sum of all `PENDING` invoices in USD.


* **Recent Invoices Table:** Filterable list showing Invoice #, Client, Amount, Due Date, Status badge, and a "Copy Payment Link" button.

### Feature 3: Stablecoin Invoice Creator (`/dashboard/invoices/new`)

* **Form Inputs:** Client Name, Client Email, Due Date, and dynamic Line Items (Description, Qty, Rate) that auto-sum the Total USDC Amount.
* **Action:** Saves the invoice to Postgres with status `PENDING` and generates a unique public URL: `/pay/[invoiceId]`.

### Feature 4: Public Client Payment Checkout (`/pay/[invoiceId]`)

* **Publicly Accessible (No login required for payer):** Displays the issuing business's name, invoice number, itemized breakdown, total USDC due, and status.
* **Payment Execution:**
* Payer clicks **"Connect Wallet to Pay"** (supports MetaMask, Coinbase Wallet, Rabby, WalletConnect via Wagmi).
* Enforces network switch to Base.
* Executes a direct ERC-20 `transfer(businessWalletAddress, exactAmountInWei)` call from the payer's wallet to the business's smart wallet.
* Once the transaction confirms on-chain (`useWaitForTransactionReceipt`), calls a backend API route (`POST /api/invoices/[id]/confirm`) that verifies the `txHash` on-chain via Viem public client (confirming recipient, amount, and token contract) before marking the invoice `PAID` in Postgres.
* Displays a downloadable/printable Payment Receipt with BaseScan transaction link.



### Feature 5: One-Click Treasury Yield Sweep (`/dashboard/treasury`)

* **Vault Interface:** Allows the business owner to move idle USDC from their Operating Account into an ERC-4626 yield vault (configurable via `NEXT_PUBLIC_VAULT_ADDRESS`) and withdraw back to idle USDC anytime.
* **Yield Split Logic & Interactive Projector:**
* Displays transparent fee breakdown: **85% User Net Yield / 15% Meridian Platform Fee**.
* Includes a 1-to-5 Year Compound Yield Projection widget comparing Idle USDC (0%) vs. Meridian Treasury Vault (~4.85% net APY).
* Includes a **Demo / Testnet Mode toggle** so if the user is testing without real Base Mainnet USDC, they can simulate a deposit/yield accrual flow smoothly.



---

## 6. Environment Variables Template (`.env.example`)

Cursor Agent must create `.env.example` with these exact keys:

```env
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@[aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true](https://aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true)"
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@[aws-0-eu-central-1.pooler.supabase.com:5432/postgres](https://aws-0-eu-central-1.pooler.supabase.com:5432/postgres)"

# Privy Auth & Embedded Wallets
NEXT_PUBLIC_PRIVY_APP_ID="your-privy-app-id"
PRIVY_APP_SECRET="your-privy-app-secret"

# Blockchain Configuration (Base Mainnet = 8453, Base Sepolia = 84532)
NEXT_PUBLIC_CHAIN_ID="84532"
NEXT_PUBLIC_RPC_URL="[https://sepolia.base.org](https://sepolia.base.org)"
NEXT_PUBLIC_USDC_ADDRESS="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
NEXT_PUBLIC_VAULT_ADDRESS="0x0000000000000000000000000000000000000000"
PROTOCOL_TREASURY_ADDRESS="0xYourProtocolFeeWalletAddress"

```

---

## 7. Agent Execution Plan (Step-by-Step)

1. **Phase 1 — Project Setup & Config:** Initialize dependencies (`@privy-io/react-auth`, `wagmi`, `viem`, `@tanstack/react-query`, `@prisma/client`, `lucide-react`), configure Tailwind/Shadcn UI components, and create `netlify.toml` configured for Next.js.
2. **Phase 2 — Database & API Layer:** Write `prisma/schema.prisma`, generate the Prisma client, and implement secure Server Actions / API routes for onboarding, invoice CRUD, and on-chain transaction verification (`viem` receipt validation).
3. **Phase 3 — Web3 Providers & Smart Wallet Hooks:** Set up `Providers.tsx` wrapping Privy + Wagmi + QueryClient, plus custom hooks (`useUsdcBalance`, `useVaultPosition`, `usePayInvoice`) with clean error handling and toast notifications.
4. **Phase 4 — UI Pages & Polish:** Build the Landing Page, Authenticated Dashboard Shell (Sidebar + Topbar), Overview Dashboard, Create Invoice Modal/Page, Public Checkout Page (`/pay/[invoiceId]`), and Treasury Vault Page with 5-year yield simulator. Verify `npm run build` passes with zero TypeScript or ESLint errors.
