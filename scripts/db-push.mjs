import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL?.trim() ?? "";
const isPlaceholder =
  !url ||
  url.includes("[project-ref]") ||
  url.includes("postgres.demo") ||
  url.includes("password@aws-0-eu-central-1") ||
  url.includes("user:pass@localhost");

if (isPlaceholder) {
  console.log("Skipping prisma db push (no real DATABASE_URL).");
  process.exit(0);
}

// Never use --accept-data-loss in build: refuse unsafe schema changes.
const result = spawnSync(
  "npx",
  ["prisma", "db", "push", "--skip-generate"],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
