import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * A real bcrypt hash of a fixed string, at the same cost as a live password.
 * Compared against when an email is unknown so the "no such user" path costs
 * the same wall-clock time as "wrong password" — without it, response timing
 * reveals which email addresses have accounts.
 */
const DUMMY_HASH = bcrypt.hashSync("nidanyo-timing-equalizer", ROUNDS);

/** Always returns false; exists purely to burn the same time as a real compare. */
export async function dummyHashCompare(plain: string): Promise<boolean> {
  try {
    await bcrypt.compare(plain, DUMMY_HASH);
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * URL-safe, non-guessable token for public report links.
 * 32 bytes -> ~43 chars base64url. Not derived from any internal id.
 */
export function publicToken(bytes = 24): string {
  return randomBytes(bytes)
    .toString("base64")
    .replace(/\+/g, "")
    .replace(/\//g, "")
    .replace(/=/g, "")
    .slice(0, 32);
}
