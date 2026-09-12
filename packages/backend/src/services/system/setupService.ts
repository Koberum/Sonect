import { setupDb, storageDb } from "@repo/db";

const SETUP_STEPS = ["storage", "audio", "sync"] as const;

// Pseudo-step persisted in setup_progress that permanently marks setup as done,
// so the wizard never re-appears even if all storage sources are later removed.
const SETUP_DONE_STEP = "complete";

export type SetupStep = (typeof SETUP_STEPS)[number];

export function getSetupProgress(): { step: SetupStep; completed: boolean }[] {
  const hasStorage = storageDb.getAll().length > 0;
  return SETUP_STEPS.map((step) => {
    const row = setupDb.get(step);
    return {
      step: step as SetupStep,
      completed: step === "storage" ? hasStorage : (row?.completed ?? false),
    };
  });
}

export function isSetupComplete(): boolean {
  const done = setupDb.get(SETUP_DONE_STEP);
  return done?.completed ?? false;
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

export function markSetupCompleted(): void {
  setupDb.setCompleted(SETUP_DONE_STEP);
}

export function resetSetup(): void {
  for (const step of SETUP_STEPS) {
    setupDb.setIncomplete(step);
  }
  setupDb.setIncomplete(SETUP_DONE_STEP);
}

export interface SetupService {
  getSetupProgress(): ReturnType<typeof getSetupProgress>;
  isSetupComplete(): boolean;
  getNextIncompleteStep(): SetupStep | null;
  markStepComplete(step: string): void;
  markStepIncomplete(step: string): void;
  markSetupCompleted(): void;
  resetSetup(): void;
}

export class SetupServiceImpl implements SetupService {
  public getSetupProgress() {
    return getSetupProgress();
  }
  public isSetupComplete() {
    return isSetupComplete();
  }
  public getNextIncompleteStep() {
    return getNextIncompleteStep();
  }
  public markStepComplete(step: string) {
    return markStepComplete(step);
  }
  public markStepIncomplete(step: string) {
    return markStepIncomplete(step);
  }
  public markSetupCompleted() {
    return markSetupCompleted();
  }
  public resetSetup() {
    return resetSetup();
  }
}
