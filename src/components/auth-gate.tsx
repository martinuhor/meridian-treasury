"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  checkUserAction,
  clearSessionAction,
  ensureCursorSessionAction,
  establishPrivySessionAction,
  onboardBusinessAction,
  syncWalletAction,
} from "@/app/actions/onboarding";
import { bootstrapDemoSessionClient } from "@/lib/demo-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileProvider, type Profile } from "@/components/profile-context";

export function AuthGate({
  children,
  requireBusiness = true,
}: {
  children: ReactNode | ((profile: Profile) => ReactNode);
  requireBusiness?: boolean;
}) {
  const router = useRouter();
  const {
    ready,
    authenticated,
    user,
    login,
    walletAddress,
    isDemo,
    getAccessToken,
  } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function establish() {
      if (!ready) return;
      if (!authenticated || !user) {
        // Don't clear cookies during demo hydration races — localStorage loads async.
        if (!isDemo) {
          try {
            await clearSessionAction();
          } catch {
            // ignore
          }
        }
        if (!cancelled) {
          setProfile(null);
          setSessionReady(false);
          setBootError(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setBootError(null);

      try {
        if (isDemo) {
          const boot = await bootstrapDemoSessionClient();
          if (!boot.ok) {
            throw new Error(boot.error);
          }
          setProfile(boot.profile);
          setSessionReady(true);
          return;
        } else {
          const token = await getAccessToken().catch(() => null);
          if (token) {
            const privy = await establishPrivySessionAction({
              accessToken: token,
            });
            if (!privy.ok) {
              await ensureCursorSessionAction();
            }
          } else {
            await ensureCursorSessionAction();
          }
        }

        const result = await checkUserAction();
        if (cancelled) return;

        if (result.user) {
          if (walletAddress && result.user.walletAddress !== walletAddress) {
            await syncWalletAction(walletAddress);
            result.user.walletAddress = walletAddress;
          }
          setProfile(result.user as Profile);
        } else {
          const email =
            typeof user.email === "string"
              ? user.email
              : user.email?.address ?? "founder@acme.africa";
          setProfile({
            id: "",
            privyUserId: "",
            email,
            walletAddress: walletAddress ?? null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            business: null,
          });
        }
        setSessionReady(true);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          const raw = err instanceof Error ? err.message : "";
          const friendly =
            !raw ||
            raw.includes("digest") ||
            raw.includes("Server Components render")
              ? "Demo sign-in failed. Please try again."
              : raw;
          setBootError(friendly);
          setSessionReady(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void establish();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user, walletAddress, isDemo, getAccessToken]);

  async function handleOnboard(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await onboardBusinessAction({
      businessName,
      country,
      walletAddress,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setProfile({
      ...result.user,
      business: result.business,
    });
    router.push("/dashboard");
  }

  if (!ready || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        Preparing your operating account…
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-2xl text-slate-900">Sign-in interrupted</h1>
        <p className="text-sm text-red-600">{bootError}</p>
        <Button
          onClick={() => {
            void (async () => {
              setBootError(null);
              setLoading(true);
              setSessionReady(false);
              login();
              const boot = await bootstrapDemoSessionClient();
              if (!boot.ok) {
                setBootError(boot.error);
                setLoading(false);
                return;
              }
              setProfile(boot.profile);
              setSessionReady(true);
              setLoading(false);
            })();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!authenticated || !sessionReady) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-3xl text-slate-900">Sign in to Meridian</h1>
        <p className="text-sm text-slate-500">
          Access your operating account, payment links, and treasury vault.
        </p>
        <Button
          size="lg"
          onClick={async () => {
            login();
            if (isDemo) {
              const boot = await bootstrapDemoSessionClient();
              if (!boot.ok) {
                setBootError(boot.error);
                return;
              }
              setProfile(boot.profile);
              setSessionReady(true);
            }
          }}
        >
          {isDemo ? "Continue in Demo Mode" : "Get Started / Sign In"}
        </Button>
      </div>
    );
  }

  if (requireBusiness && profile && !profile.business) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Set up your business</CardTitle>
            <CardDescription>
              We&apos;ll create your Meridian profile and link your self-custodied
              operating account on Base.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleOnboard}>
              <div className="space-y-2">
                <Label htmlFor="businessName">Business name</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Acme Export Co."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Nigeria"
                />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating…" : "Create business profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile || (requireBusiness && !profile.business)) {
    return null;
  }

  const content =
    typeof children === "function" ? children(profile) : children;

  return <ProfileProvider profile={profile}>{content}</ProfileProvider>;
}
