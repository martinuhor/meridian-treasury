import { createHash } from "crypto";
import { headers } from "next/headers";
import { getAuthSession } from "@/lib/auth/session";

/** Best-effort peer hint from proxy headers (never sole auth). */
export function peerHintFromHeaders(h: Headers): string {
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return "";
}

/** Stable-ish visitor fingerprint for public route throttling. */
export function visitorFingerprint(h: Headers): string {
  const ua = h.get("user-agent") ?? "";
  const al = h.get("accept-language") ?? "";
  const peer = peerHintFromHeaders(h);
  return createHash("sha256")
    .update(`${peer}\n${ua}\n${al}`)
    .digest("hex")
    .slice(0, 24);
}

/**
 * Rate-limit key that prefers the signed session subject (not spoofable).
 * Falls back to visitor fingerprint (peer hint + UA + language).
 */
export async function rateLimitKey(prefix: string): Promise<string> {
  const session = await getAuthSession();
  if (session?.subject) {
    return `${prefix}:sub:${session.subject}`;
  }

  const h = await headers();
  return `${prefix}:fp:${visitorFingerprint(h)}`;
}
