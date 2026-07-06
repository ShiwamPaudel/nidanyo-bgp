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
