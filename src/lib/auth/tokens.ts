import { randomBytes, createHash } from "crypto";

/** Opaque, high-entropy token handed to the client (in the cookie / reset link). Never stored raw. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** One-way hash stored in the database so a DB read never discloses a usable token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
