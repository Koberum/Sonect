import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/auth-context";
import { usePasswordValidation } from "@/features/auth/use-password-validation";

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
  const { validateNewPassword } = usePasswordValidation();
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
    const validationError = validateNewPassword(newPassword, confirmPassword);
    if (validationError) {
      setError(validationError);
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
          <PasswordField
            id="current-password"
            label={t("auth.currentPassword")}
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            autoFocus
          />
          <PasswordField
            id="new-password"
            label={t("auth.newPassword")}
            value={newPassword}
            onChange={setNewPassword}
          />
          <PasswordField
            id="confirm-password"
            label={t("auth.confirmPassword")}
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
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
