import { createHmac, timingSafeEqual } from "crypto";

const PLACEHOLDER_SECRETS = new Set([
  "",
  "your-privy-app-secret",
  "replace-with-a-long-random-string",
  "local-dev-session-secret-not-for-production",
]);

function claimSecret(): string | null {
  const secret = process.env.SESSION_SECRET || "";
  if (!secret || PLACEHOLDER_SECRETS.has(secret)) return null;
  return secret;
}

/** Short-lived HMAC tying confirm requests to a specific invoice id. */
export function issuePaymentClaimToken(invoiceId: string): string | null {
  const secret = claimSecret();
  if (!secret) return null;
  const exp = Date.now() + 1000 * 60 * 60 * 24; // 24h
  const body = Buffer.from(JSON.stringify({ invoiceId, exp })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPaymentClaimToken(
  invoiceId: string,
  token: string | undefined,
): boolean {
  if (!token || typeof token !== "string" || token.length > 512) return false;
  const secret = claimSecret();
  if (!secret) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as { invoiceId?: string; exp?: number };
    if (payload.invoiceId !== invoiceId) return false;
    if (!payload.exp || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
