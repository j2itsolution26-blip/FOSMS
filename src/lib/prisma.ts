import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// The pg-over-TCP adapter (@prisma/adapter-pg) pays a fresh TCP+TLS+Postgres
// handshake to Neon on every serverless invocation that doesn't land on an
// already-warm container — which, under this app's low/sporadic traffic, is
// most of them (confirmed via repeated pg connection-setup warnings in
// production logs on nearly every request, and ~2.2s+ floor even on
// back-to-back requests). Neon's own WebSocket-based driver is built for
// exactly this: cheaper connection setup from serverless/edge functions,
// while still supporting Prisma's interactive $transaction (unlike the
// plain HTTP single-query client, PrismaNeonHttp).
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

globalForPrisma.prisma = prisma;
