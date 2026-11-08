import { useTranslation } from "react-i18next";

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Password rules shared by bootstrap, profile creation and password changes.
 * Returns a localized error message, or null when the input is valid.
 */
export function usePasswordValidation() {
  const { t } = useTranslation();

  const validateLength = (password: string): string | null =>
    password.length >= MIN_PASSWORD_LENGTH ? null : t("auth.passwordTooShort");

  const validateNewPassword = (
    password: string,
    confirmPassword: string,
  ): string | null =>
    validateLength(password) ??
    (password !== confirmPassword ? t("auth.passwordsDoNotMatch") : null);

  return { validateLength, validateNewPassword };
}
