import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { isDemoSubject } from "@/lib/auth/subjects";
import { demoStore } from "@/lib/demo-store";
import { rateLimit } from "@/lib/rate-limit";
import type { SerializedBusiness, SerializedUser } from "@/lib/types";

const PLACEHOLDER_SECRETS = new Set([
  "",
  "your-privy-app-secret",
  "replace-with-a-long-random-string",
  "local-dev-session-secret-not-for-production",
]);

export const SESSION_COOKIE = "meridian_session";

function sessionSecret(): string | null {
  const primary = process.env.SESSION_SECRET || "";
  if (primary && !PLACEHOLDER_SECRETS.has(primary)) return primary;
  return null;
}

export function signSession(subject: string, email: string): string {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error(
      "SESSION_SECRET must be set. Generate one with: openssl rand -hex 32",
    );
  }
  const payload = {
    sub: subject,
    email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionToken(
  token: string,
): { sub: string; email: string } | null {
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
    ) as { sub?: string; email?: string; exp?: number };
    if (!payload.sub || !payload.email || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function fingerprintFromHeaders(headers: Headers): string {
  const ua = headers.get("user-agent") ?? "";
  const al = headers.get("accept-language") ?? "";
  return createHash("sha256")
    .update(`${ua}\n${al}`)
    .digest("hex")
    .slice(0, 24);
}

export type DemoBootstrapResult =
  | {
      ok: true;
      subject: string;
      email: string;
      profile: SerializedUser & { business: SerializedBusiness };
      sessionToken: string;
    }
  | { ok: false; error: string; status: number };

/**
 * Pure demo bootstrap used by the HTTP route (preferred) and server actions.
 * Never touches Postgres.
 */
export function bootstrapDemoSession(options: {
  existingCookie?: string | null;
  fingerprint: string;
}): DemoBootstrapResult {
  if (!sessionSecret()) {
    return {
      ok: false,
      status: 503,
      error: "SESSION_SECRET must be set. Generate one with: openssl rand -hex 32",
    };
  }

  if (options.existingCookie) {
    const existing = verifySessionToken(options.existingCookie);
    if (existing && isDemoSubject(existing.sub)) {
      const profile = demoStore.seedDemoBusinessFor(existing.sub, existing.email);
      if (profile?.business) {
        return {
          ok: true,
          subject: existing.sub,
          email: existing.email,
          profile: profile as SerializedUser & { business: SerializedBusiness },
          sessionToken: options.existingCookie,
        };
      }
    }
  }

  const limited = rateLimit(
    `demo-session:fp:${options.fingerprint}`,
    8,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return {
      ok: false,
      status: 429,
      error: `Too many demo sessions. Retry in ${limited.retryAfterSec}s.`,
    };
  }

  const subject = `demo:${randomBytes(16).toString("hex")}`;
  const email = `${subject.slice(0, 18)}@demo.meridian.local`;
  const sessionToken = signSession(subject, email);
  const profile = demoStore.seedDemoBusinessFor(subject, email);
  if (!profile?.business) {
    return {
      ok: false,
      status: 500,
      error: "Unable to prepare the demo operating account.",
    };
  }

  return {
    ok: true,
    subject,
    email,
    profile: profile as SerializedUser & { business: SerializedBusiness },
    sessionToken,
  };
}
