import { NextResponse } from "next/server";
import {
  DEMO_CHALLENGE_COOKIE,
  fingerprintFromHeaders,
  issueDemoChallenge,
} from "@/lib/demo-bootstrap";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Issues a short-lived httpOnly challenge cookie required by POST /api/demo/bootstrap.
 */
export async function GET(request: Request) {
  const fingerprint = fingerprintFromHeaders(request.headers);
  const limited = rateLimit(`demo-challenge:fp:${fingerprint}`, 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: `Too many demo challenges. Retry in ${limited.retryAfterSec}s.` },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let token: string;
  try {
    token = issueDemoChallenge();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to issue demo challenge.",
      },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 5 * 60,
  });
  return response;
}
