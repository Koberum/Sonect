import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getSetupProgress,
  updateSetupProgress,
} from "@/features/apis/systemApis";
import { WelcomeStep } from "@/features/setup/welcome-step";
import { AudioStep } from "@/features/setup/audio-step";
import { NetworkStep } from "@/features/setup/network-step";
import { StorageStep } from "@/features/setup/storage-step";
import { SyncStep } from "@/features/setup/sync-step";

const STEPS = ["welcome", "audio", "network", "storage", "sync"] as const;

function getStepIndex(progress: {
  steps: { step: string; completed: boolean }[];
}) {
  for (const s of progress.steps) {
    if (!s.completed) {
      const idx = STEPS.indexOf(s.step as (typeof STEPS)[number]);
      if (idx >= 0) return idx;
    }
  }
  return STEPS.length - 1;
}

export default function SetupWizard() {
  const navigate = useNavigate();
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
        const idx = getStepIndex(progress);
        setCurrentStep(Math.max(0, idx));
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

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const skipTo = useCallback(async () => {
    sessionStorage.setItem("setup-skipped", "1");
    goNext();
  }, [goNext]);

  const handleSkipAll = useCallback(() => {
    sessionStorage.setItem("setup-skipped", "1");
    toast.success("Setup skipped!");
    navigate("/");
  }, [navigate]);

  const handleComplete = useCallback(async () => {
    await updateSetupProgress("sync", true);
    sessionStorage.removeItem("setup-skipped");
    toast.success("Setup complete!");
    navigate("/");
  }, [navigate]);

  const labels = {
    welcome: "Welcome",
    audio: "Audio",
    network: "Network",
    storage: "Storage",
    sync: "Sync",
  } as const;

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
        <CardContent className="pt-6">
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
          <p className="text-muted-foreground mb-6 text-center text-xs font-medium tracking-wider uppercase">
            Step {currentStep + 1} of {STEPS.length} — {labels[stepLabel]}
          </p>

          {/* Step content */}
          {stepLabel === "welcome" && (
            <WelcomeStep onNext={goNext} onSkip={handleSkipAll} />
          )}
          {stepLabel === "audio" && (
            <AudioStep onNext={goNext} onSkip={skipTo} />
          )}
          {stepLabel === "network" && (
            <NetworkStep onNext={goNext} onSkip={skipTo} />
          )}
          {stepLabel === "storage" && (
            <StorageStep onNext={goNext} onSkip={skipTo} />
          )}
          {stepLabel === "sync" && (
            <SyncStep onComplete={handleComplete} onSkip={handleSkipAll} />
          )}

          {/* Back button for non-welcome, non-sync steps */}
          {currentStep > 0 && currentStep < STEPS.length - 1 && (
            <div className="mt-4 flex justify-center">
              <Button variant="ghost" size="sm" onClick={goBack}>
                Back
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
