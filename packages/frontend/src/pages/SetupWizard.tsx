import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/features/auth/auth-context";
import {
  completeSetup,
  isSetupCompleteForSession,
  updateSetupProgress,
} from "@/features/system/api";
import { AdminStep } from "@/features/setup/admin-step";
import { AudioStep } from "@/features/setup/audio-step";
import { StorageStep } from "@/features/setup/storage-step";
import { SyncStep } from "@/features/setup/sync-step";

const BASE_STEPS = ["storage", "audio", "sync"] as const;
type BaseStep = (typeof BASE_STEPS)[number];
type Step = "admin" | BaseStep;

export default function SetupWizard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { bootstrapRequired, isAdmin } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdminStep, setShowAdminStep] = useState<boolean | null>(null);
  const didInit = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Initialize once. In particular, do not re-check progress when the auth
    // state flips after bootstrap: a late "false" could overwrite the cache set
    // by a fast Skip and reset the current step.
    if (!didInit.current) {
      didInit.current = true;

      const load = async () => {
        // The admin does not exist yet, and /system/setup/progress is admin-only.
        if (bootstrapRequired) {
          setShowAdminStep(true);
          setCurrentStep(0);
          setLoading(false);
          return;
        }

        // Non-admins cannot complete setup and must not hit the admin-only API.
        if (!isAdmin) {
          navigate("/", { replace: true });
          return;
        }

        try {
          const complete = await isSetupCompleteForSession();
          if (!mountedRef.current) return;

          if (complete) {
            navigate("/", { replace: true });
            return;
          }

          setShowAdminStep(false);
          setCurrentStep(0);
        } catch {
          if (mountedRef.current) setShowAdminStep(false);
        } finally {
          if (mountedRef.current) setLoading(false);
        }
      };

      void load();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [bootstrapRequired, isAdmin, navigate]);

  const steps: Step[] = showAdminStep
    ? ["admin", ...BASE_STEPS]
    : [...BASE_STEPS];
  const stepCount = steps.length;

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, stepCount - 1));
  }, [stepCount]);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleSkipAll = useCallback(async () => {
    try {
      await completeSetup();
      toast.success(t("setup.wizard.skippedToast"));
      navigate("/");
    } catch {
      toast.error(t("setup.wizard.skipError"));
    }
  }, [navigate, t]);

  const handleComplete = useCallback(async () => {
    await updateSetupProgress("sync", true);
    await completeSetup();
    toast.success(t("setup.wizard.completeToast"));
    navigate("/");
  }, [navigate, t]);

  const handleAdminDone = useCallback(() => {
    setShowAdminStep(false);
    setCurrentStep(0);
  }, []);

  const stepLabels: Record<Step, string> = {
    admin: t("auth.bootstrapTitle"),
    storage: t("setup.stepNames.storage"),
    audio: t("setup.stepNames.audio"),
    sync: t("setup.stepNames.sync"),
  };

  if (loading || showAdminStep === null) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  const stepLabel = steps[currentStep];

  return (
    <div className="bg-muted/30 flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          {/* Step indicator */}
          <div className="mb-8 flex items-center justify-center gap-1">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    i === currentStep
                      ? "bg-primary text-primary-foreground"
                      : i < currentStep
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`mx-1 h-0.5 w-6 rounded transition-colors ${
                      i < currentStep ? "bg-primary/40" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step label */}
          <p className="text-muted-foreground mb-6 text-center text-xs font-medium tracking-wider uppercase">
            {t("setup.wizard.stepLabel", {
              current: currentStep + 1,
              total: steps.length,
              step: stepLabels[stepLabel],
            })}
          </p>

          {/* Step content */}
          {stepLabel === "admin" && <AdminStep onDone={handleAdminDone} />}
          {stepLabel === "storage" && (
            <StorageStep
              onNext={goNext}
              onBack={currentStep > 0 ? goBack : undefined}
            />
          )}
          {stepLabel === "audio" && <AudioStep onNext={goNext} />}
          {stepLabel === "sync" && <SyncStep onComplete={handleComplete} />}

          {/* Skipping is not allowed until the first administrator exists. */}
          {!showAdminStep && (
            <div className="mt-4 flex justify-center">
              <Button variant="link" onClick={() => void handleSkipAll()}>
                {t("setup.welcome.skipWizard")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}
