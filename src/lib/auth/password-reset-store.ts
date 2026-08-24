/**
 * Minimal in-memory store for password-reset tokens, keyed per process —
 * same pattern and same tradeoffs as `lib/auth/rate-limit.ts` (doesn't
 * survive a restart, doesn't share state across multiple instances). This
 * deliberately avoids adding a database table for a short-lived (30 minute),
 * single-use, hashed token — for a multi-instance production deployment,
 * swap this for a Redis-backed store or a dedicated DB table.
 *
 * Tokens are never stored raw, only their SHA-256 hash (via lib/auth/tokens.ts,
 * the same helper sessions use), so a memory dump doesn't disclose a usable link.
 */

import { PASSWORD_RESET_TOKEN_TTL_MS } from "@/lib/auth/constants";

type ResetEntry = { userId: string; expiresAt: number };

const tokens = new Map<string, ResetEntry>();

export function storeResetToken(tokenHash: string, userId: string): void {
  tokens.set(tokenHash, { userId, expiresAt: Date.now() + PASSWORD_RESET_TOKEN_TTL_MS });
}

/** Validates and immediately invalidates the token (single use), returning the userId or null. */
export function consumeResetToken(tokenHash: string): string | null {
  const entry = tokens.get(tokenHash);
  if (!entry) return null;
  tokens.delete(tokenHash);
  if (entry.expiresAt < Date.now()) return null;
  return entry.userId;
}

/** Invalidates every outstanding reset token for a user (e.g. after a successful reset). */
export function invalidateResetTokensForUser(userId: string): void {
  for (const [hash, entry] of tokens) {
    if (entry.userId === userId) tokens.delete(hash);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [hash, entry] of tokens) {
    if (entry.expiresAt < now) tokens.delete(hash);
  }
}, 1000 * 60 * 5).unref?.();
