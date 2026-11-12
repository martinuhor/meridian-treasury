import { siteConfig } from "@/config/site";

export function LandingSections() {
  return (
    <>
      <section id="how-it-works" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-display text-3xl tracking-tight text-slate-900 md:text-4xl">
            From invoice to yield in three steps
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Built for agencies and exporters who bill international clients in USD
            and want idle balances working overnight—without giving up custody.
          </p>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                title: "Issue a payment link",
                body: "Create a professional USDC invoice with line items. Share a public checkout URL with your client.",
              },
              {
                title: "Receive into your operating account",
                body: "Clients pay from MetaMask, Coinbase Wallet, or WalletConnect. Funds land directly in your self-custodied smart wallet on Base.",
              },
              {
                title: "Sweep into treasury vaults",
                body: "Move idle USDC into audited USD Treasury vaults in one click. You keep 85% of the annualized yield.",
              },
            ].map((step, i) => (
              <div key={step.title} className="relative">
                <p className="font-mono text-sm text-slate-400">0{i + 1}</p>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-display text-3xl tracking-tight text-slate-900 md:text-4xl">
              Transparent yield split
            </h2>
            <p className="mt-3 text-slate-600">
              Meridian never pools customer funds. Performance fees are calculated
              on earned yield only—{siteConfig.userYieldShare * 100}% stays with
              your business.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex h-3 overflow-hidden rounded-full">
              <div
                className="bg-slate-900"
                style={{ width: `${siteConfig.userYieldShare * 100}%` }}
              />
              <div
                className="bg-slate-300"
                style={{ width: `${siteConfig.platformFeeShare * 100}%` }}
              />
            </div>
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-slate-700">
                {siteConfig.userYieldShare * 100}% business net yield
              </span>
              <span className="text-slate-500">
                {siteConfig.platformFeeShare * 100}% platform fee
              </span>
            </div>
            <p className="mt-4 font-mono text-2xl tabular-nums text-slate-900">
              {(siteConfig.defaultNetApy * 100).toFixed(2)}% net APY
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Fallback projection when vault rate data is unavailable on testnet.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-lg text-slate-900">{siteConfig.name}</p>
          <p className="text-sm text-slate-500">
            Non-custodial · Base network · Built for Netlify + Supabase
          </p>
        </div>
      </footer>
    </>
  );
}
