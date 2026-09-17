/**
 * Creates the Front Desk A–O trainee logins that don't exist yet.
 *
 *   FRONT_DESK_INITIAL_PASSWORD='…' npx tsx scripts/provision-front-desk-accounts.ts --status=active
 *   FRONT_DESK_INITIAL_PASSWORD='…' npx tsx scripts/provision-front-desk-accounts.ts --status=deactivated
 *
 * Create-only and safe to re-run: an account that already exists is never
 * modified — its password, status, name and records are left exactly as the
 * Supervisor last set them. Only the 15 roster accounts are ever created.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";

import { FRONT_DESK_ACCOUNTS, FRONT_DESK_ROLE } from "../src/config/front-desk-accounts";
import { strongPasswordSchema } from "../src/validators/user.schema";

async function main() {
  const statusArg = process.argv.find((a) => a.startsWith("--status="))?.split("=")[1];
  if (statusArg !== "active" && statusArg !== "deactivated") {
    throw new Error("Pass --status=active or --status=deactivated for newly created accounts.");
  }
  const password = strongPasswordSchema.safeParse(process.env.FRONT_DESK_INITIAL_PASSWORD ?? "");
  if (!password.success) {
    throw new Error(`FRONT_DESK_INITIAL_PASSWORD is missing or too weak: ${password.error.issues[0]?.message}`);
  }

  neonConfig.webSocketConstructor = ws;
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
  try {
    const role = await prisma.role.findUnique({ where: { name: FRONT_DESK_ROLE } });
    if (!role) throw new Error(`Role ${FRONT_DESK_ROLE} does not exist — run the seed first.`);

    const passwordHash = await bcrypt.hash(password.data, 12);
    for (const def of FRONT_DESK_ACCOUNTS) {
      const existing = await prisma.user.findUnique({ where: { email: def.email }, select: { id: true } });
      if (existing) {
        console.log(`exists   ${def.firstName} ${def.lastName} <${def.email}> — unchanged`);
        continue;
      }
      await prisma.user.create({
        data: {
          email: def.email,
          firstName: def.firstName,
          lastName: def.lastName,
          passwordHash,
          isActive: statusArg === "active",
          roles: { create: { roleId: role.id } },
        },
      });
      console.log(`created  ${def.firstName} ${def.lastName} <${def.email}> — ${statusArg}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
