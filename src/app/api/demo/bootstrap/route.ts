import { NextResponse } from "next/server";
import {
  DEMO_CHALLENGE_COOKIE,
  SESSION_COOKIE,
  bootstrapDemoSession,
  fingerprintFromHeaders,
} from "@/lib/demo-bootstrap";

export const runtime = "nodejs";

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const part = header
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  if (!part) return null;
  try {
    return decodeURIComponent(part.slice(name.length + 1));
  } catch {
    return part.slice(name.length + 1);
  }
}

/**
 * Preferred demo login path: requires a prior GET /api/demo/challenge cookie,
 * then sets the session cookie and returns a seeded in-memory profile.
 */
export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const existingCookie = readCookie(cookieHeader, SESSION_COOKIE);
  const challengeToken = readCookie(cookieHeader, DEMO_CHALLENGE_COOKIE);

  let result;
  try {
    result = bootstrapDemoSession({
      existingCookie,
      challengeToken,
      fingerprint: fingerprintFromHeaders(request.headers),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to start demo session.",
      },
      { status: 500 },
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  const response = NextResponse.json({
    ok: true,
    subject: result.subject,
    email: result.email,
    profile: result.profile,
  });

  response.cookies.set(SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  // One-time challenge — clear after successful bootstrap.
  response.cookies.set(DEMO_CHALLENGE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
