import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import type { PublicProfile } from "@repo/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiError } from "@/lib/api";
import { ProfileCard } from "@/features/profiles/components/profile-card";
import { authQueries } from "./queries";
import { useAuth } from "./auth-context";

function ProfileGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const {
    data: profiles,
    isLoading,
    isError,
    refetch,
  } = useQuery(authQueries.profiles());
  const [selected, setSelected] = useState<PublicProfile | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    if (!selected || !password || pending) return;
    setPending(true);
    setError(null);
    try {
      await login({ profileId: selected.id, password });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? t("auth.tooManyAttempts", {
              seconds: err.retryAfterSeconds ?? 900,
            })
          : t("auth.invalidCredentials"),
      );
      setPassword("");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-muted/30 flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">
              {selected ? selected.name : t("auth.loginTitle")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {selected
                ? t("auth.enterPasswordFor", { name: selected.name })
                : t("auth.chooseProfile")}
            </p>
          </div>

          {!selected && (
            <>
              {isError && (
                <div
                  role="alert"
                  className="border-destructive/30 bg-destructive/5 flex flex-col items-center gap-3 rounded-lg border p-4"
                >
                  <p className="text-destructive text-sm">
                    {t("profile.errors.load")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void refetch()}
                  >
                    {t("profile.retry")}
                  </Button>
                </div>
              )}
              {isLoading && <ProfileGridSkeleton />}
              {profiles && profiles.length === 0 && (
                <EmptyState icon={Users} title={t("auth.noProfiles")} />
              )}
              {profiles && profiles.length > 0 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {profiles.map((candidate) => (
                    <ProfileCard
                      key={candidate.id}
                      profile={candidate}
                      onSelect={(target) => {
                        setSelected(target);
                        setPassword("");
                        setError(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {selected && (
            <form
              className="mx-auto flex w-full max-w-sm flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-password">{t("auth.password")}</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoFocus
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={!password || pending}>
                {pending && <Loader2 className="animate-spin" />}
                {pending ? t("auth.signingIn") : t("auth.signIn")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setSelected(null);
                  setPassword("");
                  setError(null);
                }}
              >
                {t("auth.backToProfiles")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
