import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  bootstrapDemoSession,
  fingerprintFromHeaders,
} from "@/lib/demo-bootstrap";

export const runtime = "nodejs";

/**
 * Preferred demo login path: sets the session cookie on the HTTP response
 * and returns a seeded in-memory profile. Avoids Server Action cookie/digest
 * failures on the hosted runtime.
 *
 * Throttling is per-visitor fingerprint inside bootstrapDemoSession — no
 * shared global bucket one caller can exhaust for everyone.
 */
export async function POST(request: Request) {
  const existingCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  let result;
  try {
    result = bootstrapDemoSession({
      existingCookie: existingCookie ? decodeURIComponent(existingCookie) : null,
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

  return response;
}
