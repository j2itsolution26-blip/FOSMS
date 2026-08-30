import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const guests = await prisma.guest.findMany({
  orderBy: { createdAt: "asc" },
  include: {
    reservations: {
      include: {
        room: { select: { id: true, number: true, status: true } },
        checkIn: true,
        checkOut: true,
        transactions: { select: { id: true, transactionNo: true, type: true, amount: true } },
      },
    },
  },
});

for (const g of guests) {
  console.log("----------------------------------------");
  console.log(`id=${g.id}`);
  console.log(`name="${g.firstName}" mid="${g.middleName ?? ""}" last="${g.lastName}"`);
  console.log(`email=${g.email} phone=${g.phone} createdAt=${g.createdAt.toISOString()}`);
  for (const r of g.reservations) {
    console.log(
      `  reservation ${r.reservationNo} status=${r.status} room=${r.room.number}(${r.room.status}) checkIn=${!!r.checkIn} checkOut=${!!r.checkOut} txns=${r.transactions.length}`
    );
  }
}
console.log("----------------------------------------");
console.log("TOTAL GUESTS:", guests.length);

await prisma.$disconnect();
