import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth-context";

type ChangePasswordDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function ChangePasswordDialog({
  open,
  onClose,
}: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setPending(false);
  }, [open]);

  const handleSubmit = async (): Promise<void> => {
    if (!currentPassword || !newPassword || pending) return;
    if (newPassword.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success(t("auth.passwordChanged"));
      onClose();
    } catch {
      setError(t("auth.changePasswordError"));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("auth.changePassword")}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-password">
              {t("auth.currentPassword")}
            </Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">
              {t("auth.confirmPassword")}
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
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
            <Button
              type="submit"
              disabled={!currentPassword || !newPassword || pending}
            >
              {pending && <Loader2 className="animate-spin" />}
              {t("auth.changePassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
