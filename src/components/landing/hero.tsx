"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { ArrowRight } from "lucide-react";
import { siteConfig } from "@/config/site";
import {
  createDemoUser,
  persistDemoUser,
} from "@/components/demo-auth-provider";
import { Button } from "@/components/ui/button";

/**
 * Landing CTAs persist demo credentials, then navigate to /dashboard.
 * Prefer real links so navigation still works if a handler is blocked.
 */
export function LandingHero() {
  const [busy, setBusy] = useState(false);
  const isDemo = !(
    process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
    process.env.NEXT_PUBLIC_PRIVY_APP_ID !== "your-privy-app-id"
  );

  async function enterDemo(e?: MouseEvent) {
    if (busy) {
      e?.preventDefault();
      return;
    }
    e?.preventDefault();
    setBusy(true);
    try {
      persistDemoUser(createDemoUser());
      // Challenge + bootstrap so the httpOnly demo cookie is ready before nav.
      await fetch("/api/demo/challenge", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      }).catch(() => null);
      await fetch("/api/demo/bootstrap", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      }).catch(() => null);
      window.location.assign("/dashboard");
    } catch {
      setBusy(false);
      window.alert("Could not start demo. Please refresh and try again.");
    }
  }

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(148,163,184,0.35),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(226,232,240,0.9),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#e8eef5_55%,#dbe4ef_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22><path fill=%22none%22 stroke=%22%23cbd5e1%22 stroke-opacity=%220.45%22 d=%22M0 39.5h40M39.5 0v40%22/></svg>')] opacity-60" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col px-6 pb-16 pt-6">
        <header className="relative z-30 flex items-center justify-between">
          <p className="font-display text-2xl tracking-tight text-slate-900 md:text-3xl">
            {siteConfig.name}
          </p>
          <Link
            href="/dashboard"
            onClick={enterDemo}
            aria-disabled={busy}
            className="relative z-30 inline-flex h-11 min-w-[6.5rem] cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </Link>
        </header>

        <div className="mt-16 grid flex-1 items-center gap-12 lg:mt-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative z-20 max-w-xl animate-fade-up">
            <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              {siteConfig.name}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg">
              Professional USDC payment links and automated treasury yield for
              exporters and agencies across Africa—self-custodied, institutional,
              and built for Base.
            </p>
            <div className="relative z-20 mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                onClick={enterDemo}
                aria-disabled={busy}
                className="animate-soft-pulse inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-6 text-sm font-medium text-white hover:bg-slate-800 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              >
                {busy ? "Signing in…" : isDemo ? "Try demo" : "Get Started / Sign In"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Button asChild size="lg" variant="secondary">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
          </div>

          <div className="relative z-0 animate-fade-up-delayed">
            <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-slate-200/60 via-white/40 to-slate-300/30 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/80 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
              <div className="border-b border-slate-100 px-6 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Operating account
                </p>
                <p className="mt-1 font-display text-2xl text-slate-900">$12,450.50 USDC</p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100">
                <div className="bg-white px-6 py-5">
                  <p className="text-xs text-slate-400">Treasury vault</p>
                  <p className="mt-1 font-mono text-lg tabular-nums text-slate-900">
                    $8,200.00
                  </p>
                </div>
                <div className="bg-white px-6 py-5">
                  <p className="text-xs text-slate-400">Net annualized yield</p>
                  <p className="mt-1 font-mono text-lg tabular-nums text-emerald-700">
                    4.85%
                  </p>
                </div>
              </div>
              <div className="space-y-3 px-6 py-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Payment link · Northwind Labs</span>
                  <span className="font-mono tabular-nums text-slate-900">$6,300</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-2/3 animate-progress rounded-full bg-slate-900" />
                </div>
                <p className="text-xs text-slate-400">
                  Funds settle peer-to-peer into your smart wallet—Meridian never holds custody.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
