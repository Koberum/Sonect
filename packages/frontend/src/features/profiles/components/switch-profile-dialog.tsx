import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import type { PublicProfile } from "@repo/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api";

type SwitchProfileDialogProps = {
  target: PublicProfile | null;
  onClose: () => void;
};

export function SwitchProfileDialog({
  target,
  onClose,
}: SwitchProfileDialogProps) {
  const { t } = useTranslation();
  const { switchProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPassword("");
    setError(null);
    setPending(false);
  }, [target?.id]);

  const handleSubmit = async (): Promise<void> => {
    if (!target || !password || pending) return;
    setPending(true);
    setError(null);
    try {
      await switchProfile({ profileId: target.id, password });
      onClose();
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
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("auth.switchTitle")}</DialogTitle>
          <DialogDescription>
            {t("auth.switchDescription", { name: target?.name ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="switch-profile-password">
              {t("auth.password")}
            </Label>
            <Input
              id="switch-profile-password"
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!password || pending}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? t("auth.switching") : t("auth.switch")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
