import { setupDb } from "@repo/db";

const SETUP_STEPS = ["audio", "network", "storage", "sync"] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

export function getSetupProgress(): { step: SetupStep; completed: boolean }[] {
  const allSteps = SETUP_STEPS.map((step) => {
    const row = setupDb.get(step);
    return {
      step: step as SetupStep,
      completed: row?.completed ?? false,
    };
  });
  return allSteps;
}

export function isSetupComplete(): boolean {
  const progress = getSetupProgress();
  return progress.every((s) => s.completed);
}

export function getNextIncompleteStep(): SetupStep | null {
  const progress = getSetupProgress();
  const incomplete = progress.find((s) => !s.completed);
  return incomplete?.step ?? null;
}

export function markStepComplete(step: string): void {
  setupDb.setCompleted(step);
}

export function markStepIncomplete(step: string): void {
  setupDb.setIncomplete(step);
}

export function resetSetup(): void {
  for (const step of SETUP_STEPS) {
    setupDb.setIncomplete(step);
  }
}
