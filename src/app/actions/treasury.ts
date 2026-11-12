"use server";

import { z } from "zod";
import { getYieldPosition, upsertYieldPosition } from "@/lib/data";
import { requireOwnedBusiness } from "@/lib/auth/session";

const upsertSchema = z.object({
  depositedPrincipal: z.number().nonnegative(),
  sharesHeld: z.number().nonnegative(),
  lastDepositTxHash: z.string().nullable().optional(),
});

export async function getYieldPositionAction() {
  const owned = await requireOwnedBusiness();
  if (!owned.ok) return { position: null, error: owned.error };
  const position = await getYieldPosition(owned.profile.business.id);
  return { position };
}

export async function upsertYieldPositionAction(input: unknown) {
  const owned = await requireOwnedBusiness();
  if (!owned.ok) return { ok: false as const, error: owned.error };

  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid treasury position." };
  }
  try {
    const position = await upsertYieldPosition(
      owned.profile.business.id,
      parsed.data,
    );
    return { ok: true as const, position };
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to update treasury position." };
  }
}
