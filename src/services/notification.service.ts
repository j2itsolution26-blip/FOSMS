import "server-only";
import { prisma } from "@/lib/prisma";

export async function getUnreadNotifications(userId: string) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { items, unreadCount };
}

export async function markNotificationRead(id: string, userId: string) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  relatedId?: string | null
) {
  return prisma.notification.create({
    data: { userId, title, message, type, relatedId: relatedId ?? null },
  });
}
