import { createHash } from "crypto";
import { headers } from "next/headers";
import { getAuthSession } from "@/lib/auth/session";

/**
 * Rate-limit key that prefers the signed session subject (not spoofable).
 * Falls back to a weak UA fingerprint — never trusts X-Forwarded-For alone.
 */
export async function rateLimitKey(prefix: string): Promise<string> {
  const session = await getAuthSession();
  if (session?.subject) {
    return `${prefix}:sub:${session.subject}`;
  }

  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const al = h.get("accept-language") ?? "";
  const fp = createHash("sha256")
    .update(`${ua}\n${al}`)
    .digest("hex")
    .slice(0, 24);
  return `${prefix}:fp:${fp}`;
}
