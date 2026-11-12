"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FilePlus2,
  Landmark,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/hooks/use-auth";
import { clearSessionAction } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { cn, shortenAddress } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/invoices/new", label: "New Invoice", icon: FilePlus2 },
  { href: "/dashboard/treasury", label: "Treasury Vault", icon: Landmark },
];

export function DashboardShell({
  children,
  businessName,
  walletAddress,
}: {
  children: ReactNode;
  businessName: string;
  walletAddress?: string | null;
}) {
  const pathname = usePathname();
  const { logout, isDemo } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#f8fafc_0%,_#eef2f7_45%,_#e2e8f0_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200/80 bg-white/90 backdrop-blur md:static md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}
        >
          <div className="flex h-16 items-center justify-between px-5">
            <Link href="/" className="font-display text-xl tracking-tight text-slate-900">
              {siteConfig.name}
            </Link>
            <button className="md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
          <div className="px-5 pb-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Business</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-800">{businessName}</p>
            <p className="mt-1 font-mono text-xs text-slate-500">
              {shortenAddress(walletAddress)}
            </p>
            {isDemo ? (
              <p className="mt-2 text-xs text-amber-700">Demo mode — no live custody keys</p>
            ) : null}
          </div>
          <nav className="space-y-1 px-3">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4 md:static md:mt-8 md:border-0">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-slate-600"
              onClick={() => {
                void clearSessionAction().then(() => logout());
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/70 bg-white/70 px-4 backdrop-blur md:px-8">
            <button
              className="md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 text-slate-700" />
            </button>
            <p className="text-sm text-slate-500">
              Self-custodied operating account · Base network
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/invoices/new">Create payment link</Link>
            </Button>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
      {open ? (
        <button
          className="fixed inset-0 z-30 bg-slate-900/20 md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close overlay"
        />
      ) : null}
    </div>
  );
}
