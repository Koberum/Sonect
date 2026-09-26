import type { DatabaseTransaction, DrizzleDatabase } from "../connection.js";

// Any synchronous Drizzle executor: either the root database handle or the
// transaction handle passed to a transaction() callback.
export type QueryExecutor = DrizzleDatabase | DatabaseTransaction;

// node:sqlite reports lastInsertRowid as number | bigint. Row ids are consumed
// as plain numbers throughout the repositories, so a value outside the safe
// integer range would silently lose precision when narrowed — refuse it.
export function normalizeRowId(value: number | bigint): number {
  if (typeof value === "bigint") {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(
        `lastInsertRowid ${value} is not a safe JavaScript integer`,
      );
    }
    return Number(value);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `lastInsertRowid ${value} is not a safe JavaScript integer`,
    );
  }
  return value;
}
