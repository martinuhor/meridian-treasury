import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function hasRealDatabaseUrl(url: string) {
  return (
    Boolean(url) &&
    !url.includes("[project-ref]") &&
    !url.includes("postgres.demo") &&
    !url.includes("password@aws-0-eu-central-1") &&
    !url.includes("user:pass@localhost")
  );
}

/**
 * In-memory demo store is opt-in via DEMO_MODE=true, or local/dev only when
 * no real DATABASE_URL is configured. Production never silently falls back.
 */
export function isDemoMode() {
  if (process.env.DEMO_MODE === "true") return true;
  if (process.env.DEMO_MODE === "false") return false;

  const url = process.env.DATABASE_URL ?? "";
  if (hasRealDatabaseUrl(url)) return false;

  // Hosted/production builds must not invent a shared memory datastore.
  if (process.env.NODE_ENV === "production") return false;

  return !url || !hasRealDatabaseUrl(url);
}
