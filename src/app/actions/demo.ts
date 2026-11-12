"use server";

import { requireAuthSession } from "@/lib/auth/session";
import { ensureDemoProfileForSubject } from "@/lib/data";
import { isDemoMode } from "@/lib/db";

export async function ensureDemoSeedAction() {
  const auth = await requireAuthSession();
  if (!auth.ok) return { ok: false as const, error: auth.error };
  if (!isDemoMode()) {
    return { ok: false as const, error: "Demo seed is disabled." };
  }
  const profile = await ensureDemoProfileForSubject(
    auth.session.subject,
    auth.session.email,
  );
  return { ok: true as const, profile };
}
