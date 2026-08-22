import type { Prisma } from "@prisma/client";

/**
 * Atomically issues the next number for a given prefix/kind ("SR", "TXN", ...),
 * scoped per calendar year, e.g. SR-2026-000001. Backed by `NumberSequence`, a
 * single upsert per call — Postgres serializes concurrent upserts on the same
 * row, so two requests racing for the same kind/year can't get the same number.
 */
export async function nextNumber(
  tx: Prisma.TransactionClient,
  kind: string,
  prefix: string,
  padding = 6
): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await tx.numberSequence.upsert({
    where: { kind_year: { kind, year } },
    create: { kind, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(seq.lastNumber).padStart(padding, "0")}`;
}
