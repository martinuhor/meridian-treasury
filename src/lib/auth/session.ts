import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { getIdentity } from "../../../cursor/identity";
import { isDemoSubject } from "@/lib/auth/subjects";
import { getUserProfile, ensureDemoProfileForSubject } from "@/lib/data";
import type { SerializedBusiness, SerializedUser } from "@/lib/types";

export const SESSION_COOKIE = "meridian_session";

type SessionPayload = {
  sub: string;
  email: string;
  exp: number;
};

export type AuthSession = {
  subject: string;
  email: string;
  source: "cursor" | "session";
};

export type AuthedProfile = SerializedUser & {
  business: SerializedBusiness | null;
};

const PLACEHOLDER_SECRETS = new Set([
  "",
  "your-privy-app-secret",
  "replace-with-a-long-random-string",
  "local-dev-session-secret-not-for-production",
]);

/** Dedicated SESSION_SECRET only — never reuse PRIVY_APP_SECRET. */
function sessionSecret(): string | null {
  const primary = process.env.SESSION_SECRET || "";
  if (primary && !PLACEHOLDER_SECRETS.has(primary)) {
    return primary;
  }
  return null;
}

function sign(payload: SessionPayload) {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error(
      "SESSION_SECRET must be set. Generate one with: openssl rand -hex 32",
    );
  }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.sub || !payload.email || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function readSessionCookie(): Promise<SessionPayload | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(SESSION_COOKIE)?.value;
    if (!raw) return null;
    return verify(raw);
  } catch {
    return null;
  }
}

export async function createSessionCookie(subject: string, email: string) {
  const token = sign({
    sub: subject,
    email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSessionCookie() {
  try {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
  } catch {
    // ignore — clearing is best-effort during auth transitions
  }
}

/**
 * Prefer a valid demo session cookie over Cursor identity so "Try demo"
 * works on public apps where the platform may still attach a viewer identity.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieSession = await readSessionCookie();
  if (cookieSession && isDemoSubject(cookieSession.sub)) {
    return {
      subject: cookieSession.sub,
      email: cookieSession.email,
      source: "session",
    };
  }

  try {
    const headerStore = await headers();
    const identity = await getIdentity(headerStore);
    if (identity.verified && identity.kind === "person") {
      return {
        subject: `cursor:${identity.sub}`,
        email: identity.email || `${identity.sub}@users.cursor`,
        source: "cursor",
      };
    }
  } catch {
    // Identity is optional on public apps — fall through to cookie.
  }

  if (!cookieSession) return null;
  return {
    subject: cookieSession.sub,
    email: cookieSession.email,
    source: "session",
  };
}

export async function requireAuthSession(): Promise<
  { ok: true; session: AuthSession } | { ok: false; error: string }
> {
  const session = await getAuthSession();
  if (!session) {
    return { ok: false, error: "Sign in required." };
  }
  return { ok: true, session };
}

export async function requireAuthedProfile(): Promise<
  | { ok: true; session: AuthSession; profile: AuthedProfile }
  | { ok: false; error: string }
> {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth;

  // Serverless isolates lose in-memory demo tenants — reseed from the cookie.
  if (isDemoSubject(auth.session.subject)) {
    const seeded = await ensureDemoProfileForSubject(
      auth.session.subject,
      auth.session.email,
    );
    if (seeded) {
      return {
        ok: true,
        session: auth.session,
        profile: seeded as AuthedProfile,
      };
    }
  }

  const profile = await getUserProfile(auth.session.subject);
  if (!profile) {
    return { ok: false, error: "Business profile not found." };
  }
  return {
    ok: true,
    session: auth.session,
    profile: profile as AuthedProfile,
  };
}

export async function requireOwnedBusiness(): Promise<
  | {
      ok: true;
      session: AuthSession;
      profile: AuthedProfile & { business: SerializedBusiness };
    }
  | { ok: false; error: string }
> {
  const result = await requireAuthedProfile();
  if (!result.ok) return result;
  if (!result.profile.business) {
    return { ok: false, error: "Complete business onboarding first." };
  }
  return {
    ok: true,
    session: result.session,
    profile: result.profile as AuthedProfile & { business: SerializedBusiness },
  };
}

export function newDemoSubject() {
  return `demo:${randomBytes(16).toString("hex")}`;
}
