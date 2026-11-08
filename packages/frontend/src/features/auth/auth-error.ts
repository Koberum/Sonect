import type { TFunction } from "i18next";
import { ApiError } from "@/lib/api";

/** Maps login/switch failures, keeping the throttle retry hint. */
export function getAuthErrorMessage(error: unknown, t: TFunction): string {
  return error instanceof ApiError && error.status === 429
    ? t("auth.tooManyAttempts", {
        seconds: error.retryAfterSeconds ?? 900,
      })
    : t("auth.invalidCredentials");
}
