import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

// promisify picks the callback overload without options; the hash format below
// pins N/r/p explicitly so both hashing and verification use the same values.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;
const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MIN_N = 2 ** 10;
const MAX_N = 2 ** 20;
const MAX_R = 32;
const MAX_P = 16;
const MIN_KEY_LENGTH = 16;
const MAX_KEY_LENGTH = 128;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("base64url");
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
  });
  return `scrypt$${N}$${R}$${P}$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const iterations = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  if (
    !Number.isInteger(iterations) ||
    iterations < MIN_N ||
    iterations > MAX_N ||
    (iterations & (iterations - 1)) !== 0 ||
    !Number.isInteger(blockSize) ||
    blockSize < 1 ||
    blockSize > MAX_R ||
    !Number.isInteger(parallelization) ||
    parallelization < 1 ||
    parallelization > MAX_P
  ) {
    return false;
  }
  const expected = Buffer.from(parts[5], "base64url");
  if (expected.length < MIN_KEY_LENGTH || expected.length > MAX_KEY_LENGTH) {
    return false;
  }
  try {
    const derived = (await scryptAsync(password, parts[4], expected.length, {
      N: iterations,
      r: blockSize,
      p: parallelization,
    })) as Buffer;
    return (
      derived.length === expected.length && timingSafeEqual(derived, expected)
    );
  } catch {
    return false;
  }
}
