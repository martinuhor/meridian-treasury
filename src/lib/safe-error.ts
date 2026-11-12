/** Strip driver / host details from errors returned to clients. */
export function publicActionError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message || fallback;
  if (
    msg.includes("digest") ||
    msg.includes("Server Components render") ||
    /database unavailable/i.test(msg) ||
    /prisma/i.test(msg) ||
    /postgres|postgresql|neon|supabase|connection/i.test(msg) ||
    /ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg)
  ) {
    return fallback;
  }
  // Allow short, intentional domain errors (invoice limits, validation).
  if (msg.length <= 160 && !msg.includes("://") && !msg.includes("@")) {
    return msg;
  }
  return fallback;
}
