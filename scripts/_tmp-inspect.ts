import { prisma } from "@/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, isActive: true, roles: { select: { role: { select: { name: true } } } } },
    take: 10,
  });
  console.log("USERS:", JSON.stringify(users, null, 2));

  const roomTypes = await prisma.roomType.findMany({ select: { id: true, code: true, name: true, baseRate: true } });
  console.log("ROOM TYPES:", JSON.stringify(roomTypes, null, 2));

  const rooms = await prisma.room.findMany({
    where: { status: { in: ["VC", "VR", "VCI"] } },
    select: { id: true, number: true, status: true, roomType: { select: { name: true } } },
    take: 10,
  });
  console.log("AVAILABLE ROOMS:", JSON.stringify(rooms, null, 2));

  const guestCount = await prisma.guest.count();
  const reservationCount = await prisma.reservation.count();
  const txnCount = await prisma.cashierTransaction.count();
  console.log("COUNTS:", { guestCount, reservationCount, txnCount });
}

main().finally(() => prisma.$disconnect());
