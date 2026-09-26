import { asc, eq, sql } from "drizzle-orm";
import { db } from "../connection.js";
import { setupProgress } from "../tables.js";

// Public row shape: the raw `completed` integer is deliberately converted to
// a boolean at this boundary, and `completed_at` stays optional.
export type SetupStepRow = {
  step: string;
  completed: boolean;
  completed_at?: string;
};

export const setupDb = {
  getAll(): SetupStepRow[] {
    return db()
      .select()
      .from(setupProgress)
      .orderBy(asc(setupProgress.id))
      .all()
      .map((row) => ({
        ...row,
        completed: row.completed === 1,
      })) as SetupStepRow[];
  },

  get(step: string): SetupStepRow | undefined {
    const row = db()
      .select()
      .from(setupProgress)
      .where(eq(setupProgress.step, step))
      .get();
    if (!row) return undefined;
    // The raw row's `completed_at` may be SQL NULL; the legacy repository
    // passed that through the spread untouched, so the cast only narrows the
    // declared shape and does not alter the returned runtime object.
    return { ...row, completed: row.completed === 1 } as SetupStepRow;
  },

  setCompleted(step: string): void {
    db()
      .insert(setupProgress)
      .values({ step, completed: 1, completed_at: sql`CURRENT_TIMESTAMP` })
      .onConflictDoUpdate({
        target: setupProgress.step,
        set: { completed: 1, completed_at: sql`CURRENT_TIMESTAMP` },
      })
      .run();
  },

  setIncomplete(step: string): void {
    db()
      .update(setupProgress)
      .set({ completed: 0, completed_at: null })
      .where(eq(setupProgress.step, step))
      .run();
  },
};
