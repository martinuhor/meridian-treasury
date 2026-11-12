import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsdc(value: number | string, digits = 2) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function shortenAddress(address?: string | null, chars = 4) {
  if (!address) return "—";
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getUTCFullYear().toString().slice(-2);
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `MRD-${y}${m}-${rand}`;
}
