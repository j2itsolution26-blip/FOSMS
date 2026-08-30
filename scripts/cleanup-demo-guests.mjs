import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes("--dry-run");

// Confirmed demo/test/generated guest IDs — classified from src/lib manual
// inspection (see conversation): literal test markers ("Folio", "Guest<id>",
// "Test", "E2E<timestamp>Walkin" matching tests/e2e/front-office-modules.spec.ts,
// keyboard-mash garbage, or repeated identical placeholder names with zero
// contact info created seconds apart while walking through the same flow).
// Real seed guests (Juan Dela Cruz, Maria Santos, ... Miguel Torres) and the
// three "James Tan" / "James Casido Tan" records are deliberately excluded —
// no injected/generated marker distinguishes them from a real guest.
const DEMO_GUEST_IDS = [
  // "Ella Ramos" x6 — identical placeholder name, no email/phone, created
  // seconds apart while sequentially checking into rooms 101-106/204.
  "cmt416tvq002qiw96jnzywntm",
  "cmt418sbp0002qs96sc2vqjiy",
  "cmt419i5q0009qs96nvcrsq4q",
  "cmt41bef0000kqs96fnfgy9yx",
  "cmt41e1oj0010qs96v6bkj4hl",
  "cmt41fmrc001gqs96rf1elfk2",
  // "E2E<timestamp> Walkin" — matches tests/e2e/front-office-modules.spec.ts's
  // walk-in test fixture exactly; these are runs whose cleanup didn't fire.
  "cmt41iji90029qs96qmzye0e4",
  "cmt41jkoc002sqs96v7akj7yf",
  "cmt4d4a3d000sss96nmudf7g7",
  "cmt4d9qqr0008m8967tvw3vi4",
  "cmt4dfbdc0008sc96jq9p09yj",
  "cmt4djmq20014sc96kd9g1pgg",
  "cmtdxhi5t0010mc96i632hax5",
  "cmtdxpjlr00086k960si69djl",
  // Keyboard-mash garbage entry.
  "cmtbgd9ei000004l8qhku6sls", // sdadas sadasd
  // Literal "Test" placeholders.
  "cmtdx7m5f0008mc96ptwcdu8n", // Test Verify134738
  "cmtdx8jqh000hmc96073ayj3t", // Test Verify178848
  // "<Prefix>Folio<suffix> Guest<suffix>" — Guest Folio feature test fixtures.
  "cmtec79jr0004lc96utmqobz3", // TestFoliou2gucm Guestu2gucm
  "cmtec837o0009lc96d2v3nq1y", // RoomFolioewfsc6 Guestewfsc6
  "cmtec9aj1000dlc963jal92mn", // RoomFolioll3s3a Guestll3s3a
  "cmteecehd000xbo960ixtle9a", // SlimFolioq2q4v9 Guestq2q4v9
  "cmtf8zvlu0004r496zyancgdj", // NoDiscFoliobb636e Guestbb636e
  "cmtf90b7k0008r496ve8nfaxd", // NoDiscFolioxl7gqo Guestxl7gqo
  // "<Name>vghev2" — this session's own middleName-formatter verification run.
  "cmtfc2yib0002rg96r1hhyxr2", // Jamesvghev2 Casido Tanvghev2
  "cmtfc31c50004rg96xesshaui", // JamesNoMidvghev2 Tanvghev2
  "cmtfc33yy0006rg96ymwywmtc", // Mariavghev2 Santos DelaCruzvghev2
  "cmtfc36si0008rg96k469x22l", // Johnvghev2 Smithvghev2
];

// Rooms whose current "occupied" status is justified ONLY by a checked-in
// reservation belonging to one of the demo guests above, with no other
// reservation left afterward to justify it — reset to VC (Vacant and
// Cleaned) so Room Management doesn't keep showing a phantom occupant.
const ROOMS_TO_RESET = ["205", "206", "302"];

async function main() {
  const guests = await prisma.guest.findMany({
    where: { id: { in: DEMO_GUEST_IDS } },
    include: { reservations: { select: { id: true } } },
  });
  if (guests.length !== DEMO_GUEST_IDS.length) {
    const found = new Set(guests.map((g) => g.id));
    const missing = DEMO_GUEST_IDS.filter((id) => !found.has(id));
    throw new Error(`Expected ${DEMO_GUEST_IDS.length} guests, found ${guests.length}. Missing: ${missing.join(", ")}`);
  }
  const reservationIds = guests.flatMap((g) => g.reservations.map((r) => r.id));

  const [serviceRequestCount, guestDocumentCount] = await Promise.all([
    prisma.serviceRequest.count({ where: { guestId: { in: DEMO_GUEST_IDS } } }),
    prisma.guestDocument.count({ where: { guestId: { in: DEMO_GUEST_IDS } } }),
  ]);

  console.log(`Guests to delete: ${guests.length}`);
  console.log(`Reservations to delete: ${reservationIds.length}`);
  console.log(`Linked service requests: ${serviceRequestCount}`);
  console.log(`Linked guest documents (cascade): ${guestDocumentCount}`);

  if (DRY_RUN) {
    console.log("Dry run only — no changes made.");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (serviceRequestCount > 0) {
      await tx.serviceRequest.updateMany({ where: { guestId: { in: DEMO_GUEST_IDS } }, data: { guestId: null } });
    }

    const txnDel = await tx.cashierTransaction.deleteMany({ where: { reservationId: { in: reservationIds } } });
    console.log(`Deleted cashier transactions: ${txnDel.count}`);

    const checkInDel = await tx.checkIn.deleteMany({ where: { reservationId: { in: reservationIds } } });
    const checkOutDel = await tx.checkOut.deleteMany({ where: { reservationId: { in: reservationIds } } });
    console.log(`Deleted check-ins: ${checkInDel.count}, check-outs: ${checkOutDel.count}`);

    const resDel = await tx.reservation.deleteMany({ where: { id: { in: reservationIds } } });
    console.log(`Deleted reservations: ${resDel.count}`);

    const guestDel = await tx.guest.deleteMany({ where: { id: { in: DEMO_GUEST_IDS } } });
    console.log(`Deleted guests: ${guestDel.count}`);

    for (const number of ROOMS_TO_RESET) {
      const updated = await tx.room.updateMany({ where: { number }, data: { status: "VC" } });
      await tx.roomStatusHistory.create({
        data: {
          roomId: (await tx.room.findFirst({ where: { number }, select: { id: true } })).id,
          status: "VC",
          note: "Reset after removing a demo/test guest checked-in reservation that never had a matching checkout.",
        },
      });
      console.log(`Room ${number} reset to VC: ${updated.count} row(s)`);
    }
  });

  const remaining = await prisma.guest.count();
  console.log(`Remaining guests in database: ${remaining}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
