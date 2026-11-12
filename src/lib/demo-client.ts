import type { Profile } from "@/components/profile-context";

export type DemoBootstrapResponse =
  | { ok: true; subject: string; email: string; profile: Profile }
  | { ok: false; error: string };

/** Browser helper — challenge cookie then HTTP bootstrap (not Server Actions). */
export async function bootstrapDemoSessionClient(): Promise<DemoBootstrapResponse> {
  try {
    const challenge = await fetch("/api/demo/challenge", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!challenge.ok) {
      const data = (await challenge.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        error:
          data?.error ??
          `Demo challenge failed (${challenge.status}). Please try again.`,
      };
    }

    const res = await fetch("/api/demo/bootstrap", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const data = (await res.json().catch(() => null)) as
      | DemoBootstrapResponse
      | null;
    if (!res.ok || !data) {
      return {
        ok: false,
        error:
          data && "error" in data && data.error
            ? data.error
            : `Demo sign-in failed (${res.status}). Please try again.`,
      };
    }
    if (!data.ok) return data;
    if (!data.profile?.business) {
      return {
        ok: false,
        error: "Unable to prepare the demo operating account.",
      };
    }
    return data;
  } catch {
    return {
      ok: false,
      error: "Demo sign-in failed. Please try again.",
    };
  }
}
