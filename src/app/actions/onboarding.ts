"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { z } from "zod";
import {
  createSessionCookie,
  clearSessionCookie,
  getAuthSession,
  newDemoSubject,
  requireAuthSession,
} from "@/lib/auth/session";
import { isDemoSubject } from "@/lib/auth/subjects";
import {
  getUserProfile,
  onboardUser,
  syncWalletAddress,
} from "@/lib/data";
import { rateLimit } from "@/lib/rate-limit";
import { rateLimitKey } from "@/lib/request-ip";
import { publicActionError } from "@/lib/safe-error";

const onboardSchema = z.object({
  businessName: z.string().min(2).max(120),
  country: z.string().min(2).max(80).optional(),
  walletAddress: z.string().max(64).optional().nullable(),
});

const privySessionSchema = z.object({
  accessToken: z.string().min(10).max(8192),
});

async function demoFingerprintKey() {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const al = h.get("accept-language") ?? "";
  const fp = createHash("sha256")
    .update(`${ua}\n${al}`)
    .digest("hex")
    .slice(0, 24);
  return `demo-session:fp:${fp}`;
}

export async function startDemoSessionAction() {
  try {
    const existing = await getAuthSession();
    if (existing && isDemoSubject(existing.subject)) {
      return {
        ok: true as const,
        subject: existing.subject,
        email: existing.email,
      };
    }

    // Per-visitor only — no shared global bucket one caller can exhaust for all.
    const key = await demoFingerprintKey();
    const limited = rateLimit(key, 8, 60 * 60 * 1000);
    if (!limited.ok) {
      return {
        ok: false as const,
        error: `Too many demo sessions. Retry in ${limited.retryAfterSec}s.`,
      };
    }

    if (!process.env.SESSION_SECRET) {
      return {
        ok: false as const,
        error: "SESSION_SECRET must be set. Generate one with: openssl rand -hex 32",
      };
    }

    const subject = newDemoSubject();
    const email = `${subject.slice(0, 18)}@demo.meridian.local`;
    await createSessionCookie(subject, email);
    return {
      ok: true as const,
      subject,
      email,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: publicActionError(
        error,
        "Unable to start demo session. Set SESSION_SECRET in app secrets.",
      ),
    };
  }
}

/**
 * Fallback server action — prefer POST /api/demo/bootstrap from the client.
 */
export async function bootstrapDemoSessionAction() {
  try {
    const { cookies, headers: nextHeaders } = await import("next/headers");
    const { bootstrapDemoSession, fingerprintFromHeaders } = await import(
      "@/lib/demo-bootstrap"
    );
    const h = await nextHeaders();
    const jar = await cookies();
    const existing = jar.get("meridian_session")?.value ?? null;
    const headerBag = new Headers();
    h.forEach((value, key) => headerBag.set(key, value));
    const result = bootstrapDemoSession({
      existingCookie: existing,
      fingerprint: fingerprintFromHeaders(headerBag),
    });
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    await createSessionCookie(result.subject, result.email);
    return {
      ok: true as const,
      subject: result.subject,
      email: result.email,
      profile: result.profile,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: publicActionError(
        error,
        "Unable to prepare the demo operating account. Please try again.",
      ),
    };
  }
}

export async function establishPrivySessionAction(input: unknown) {
  const parsed = privySessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Missing Privy access token." };
  }

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret || appId === "your-privy-app-id") {
    return { ok: false as const, error: "Privy is not configured." };
  }

  try {
    const { PrivyClient } = await import("@privy-io/server-auth");
    const privy = new PrivyClient(appId, appSecret);
    const claims = await privy.verifyAuthToken(parsed.data.accessToken);
    const privyUserId = claims.userId;
    if (!privyUserId) {
      return { ok: false as const, error: "Invalid Privy session." };
    }

    let email = `${privyUserId}@users.privy`;
    try {
      const user = await privy.getUser(privyUserId);
      email = user.email?.address || user.google?.email || email;
    } catch {
      // email fallback is fine
    }

    const subject = `privy:${privyUserId}`;
    await createSessionCookie(subject, email);
    return { ok: true as const, subject, email };
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Privy verification failed." };
  }
}

export async function clearSessionAction() {
  await clearSessionCookie();
  return { ok: true as const };
}

export async function checkUserAction() {
  const auth = await requireAuthSession();
  if (!auth.ok) return { user: null, error: auth.error };
  const user = await getUserProfile(auth.session.subject);
  return { user };
}

export async function onboardBusinessAction(input: unknown) {
  const auth = await requireAuthSession();
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const parsed = onboardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid onboarding details." };
  }

  const key = await rateLimitKey(`onboard:${auth.session.subject}`);
  const limited = rateLimit(key, 5, 60 * 60 * 1000);
  if (!limited.ok) {
    return {
      ok: false as const,
      error: `Onboarding rate limit reached. Retry in ${limited.retryAfterSec}s.`,
    };
  }

  try {
    const result = await onboardUser({
      privyUserId: auth.session.subject,
      email: auth.session.email.slice(0, 254),
      walletAddress: parsed.data.walletAddress ?? null,
      businessName: parsed.data.businessName,
      country: parsed.data.country,
    });
    return { ok: true as const, ...result };
  } catch (error) {
    console.error(error);
    return {
      ok: false as const,
      error: publicActionError(error, "Unable to create business profile."),
    };
  }
}

export async function syncWalletAction(walletAddress: string) {
  const auth = await requireAuthSession();
  if (!auth.ok) return { ok: false as const, error: auth.error };
  if (!walletAddress || walletAddress.length > 64) {
    return { ok: false as const, error: "Invalid wallet address." };
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    if (!walletAddress.startsWith("0xDemo")) {
      return { ok: false as const, error: "Invalid wallet address." };
    }
  }

  try {
    const existing = await getUserProfile(auth.session.subject);
    if (!existing) {
      return { ok: false as const, error: "Create your business profile first." };
    }
    const user = await syncWalletAddress(auth.session.subject, walletAddress);
    return { ok: true as const, user };
  } catch (error) {
    console.error(error);
    return { ok: false as const, error: "Unable to sync wallet." };
  }
}

export async function ensureCursorSessionAction() {
  const session = await getAuthSession();
  if (!session) {
    return { ok: false as const, error: "No authenticated viewer." };
  }
  if (session.source === "cursor") {
    await createSessionCookie(session.subject, session.email);
  }
  return { ok: true as const, subject: session.subject, email: session.email };
}
