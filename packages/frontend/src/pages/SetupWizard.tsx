import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  getSetupProgress,
  updateSetupProgress,
} from "@/features/apis/systemApis";
import { WelcomeStep } from "@/features/setup/welcome-step";
import { AudioStep } from "@/features/setup/audio-step";
import { StorageStep } from "@/features/setup/storage-step";
import { SyncStep } from "@/features/setup/sync-step";

const STEPS = ["welcome", "storage", "audio", "sync"] as const;

export default function SetupWizard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const progress = await getSetupProgress();
        if (progress.complete) {
          navigate("/", { replace: true });
          return;
        }
        setCurrentStep(0);
      } catch {
        // If API fails, start from welcome
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const goNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const handleSkipAll = useCallback(() => {
    sessionStorage.setItem("setup-skipped", "1");
    toast.success(t("setup.wizard.skippedToast"));
    navigate("/");
  }, [navigate, t]);

  const handleComplete = useCallback(async () => {
    await updateSetupProgress("sync", true);
    sessionStorage.removeItem("setup-skipped");
    toast.success(t("setup.wizard.completeToast"));
    navigate("/");
  }, [navigate, t]);

  const stepLabels: Record<(typeof STEPS)[number], string> = {
    welcome: t("setup.stepNames.welcome"),
    storage: t("setup.stepNames.storage"),
    audio: t("setup.stepNames.audio"),
    sync: t("setup.stepNames.sync"),
  };

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  const stepLabel = STEPS[currentStep];

  return (
    <div className="bg-muted/30 flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleSkipAll}
            aria-label={t("setup.wizard.skip")}
            className="text-muted-foreground hover:text-foreground focus:ring-ring ml-auto rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </CardHeader>
        <CardContent>
          {/* Step indicator */}
          <div className="mb-8 flex items-center justify-center gap-1">
            {STEPS.map((step, i) => (
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
                {i < STEPS.length - 1 && (
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
          <p className="text-muted-foreground text-center text-xs font-medium tracking-wider uppercase">
            {t("setup.wizard.stepLabel", {
              current: currentStep + 1,
              total: STEPS.length,
              step: stepLabels[stepLabel],
            })}
          </p>

          {/* Step content */}
          {stepLabel === "welcome" && <WelcomeStep onNext={goNext} />}
          {stepLabel === "storage" && <StorageStep onNext={goNext} />}
          {stepLabel === "audio" && <AudioStep onNext={goNext} />}
          {stepLabel === "sync" && <SyncStep onComplete={handleComplete} />}
        </CardContent>
      </Card>
    </div>
  );
}
