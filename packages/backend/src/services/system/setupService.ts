import { setupDb, storageDb } from "@repo/db";

const SETUP_STEPS = ["storage", "audio", "sync"] as const;

// Pseudo-step persisted in setup_progress that permanently marks setup as done,
// so the wizard never re-appears even if all storage sources are later removed.
const SETUP_DONE_STEP = "complete";

export type SetupStep = (typeof SETUP_STEPS)[number];

export interface SetupService {
  getSetupProgress(): { step: SetupStep; completed: boolean }[];
  isSetupComplete(): boolean;
  getNextIncompleteStep(): SetupStep | null;
  markStepComplete(step: string): void;
  markStepIncomplete(step: string): void;
  markSetupCompleted(): void;
  resetSetup(): void;
}

export class SetupServiceImpl implements SetupService {
  public getSetupProgress(): { step: SetupStep; completed: boolean }[] {
    const hasStorage = storageDb.getAll().length > 0;
    return SETUP_STEPS.map((step) => {
      const row = setupDb.get(step);
      return {
        step: step as SetupStep,
        completed: step === "storage" ? hasStorage : (row?.completed ?? false),
      };
    });
  }

  public isSetupComplete(): boolean {
    const done = setupDb.get(SETUP_DONE_STEP);
    return done?.completed ?? false;
  }

  public getNextIncompleteStep(): SetupStep | null {
    const progress = this.getSetupProgress();
    const incomplete = progress.find((s) => !s.completed);
    return incomplete?.step ?? null;
  }

  public markStepComplete(step: string): void {
    setupDb.setCompleted(step);
  }

  public markStepIncomplete(step: string): void {
    setupDb.setIncomplete(step);
  }

  public markSetupCompleted(): void {
    setupDb.setCompleted(SETUP_DONE_STEP);
  }

  public resetSetup(): void {
    for (const step of SETUP_STEPS) {
      setupDb.setIncomplete(step);
    }
    setupDb.setIncomplete(SETUP_DONE_STEP);
  }
}
