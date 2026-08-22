import "server-only";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import type { SettingsInput } from "@/validators/settings.schema";

type ActorContext = { userId: string; role: string | null; ipAddress?: string | null; userAgent?: string | null };

const SETTINGS_KEY = "general";

const DEFAULT_SETTINGS: SettingsInput = {
  orgName: "Front Office Training Center",
  contactEmail: "",
  supportPhone: "",
  dateFormat: "MMM D, YYYY",
};

export async function getSettings(): Promise<SettingsInput> {
  const row = await prisma.systemSetting.findUnique({ where: { key: SETTINGS_KEY } });
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<SettingsInput>) ?? {}) };
}

export async function updateSettings(input: SettingsInput, actor: ActorContext) {
  const previous = await getSettings();

  await prisma.systemSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: input },
    create: { key: SETTINGS_KEY, value: input },
  });

  await recordAudit({
    userId: actor.userId,
    role: actor.role,
    action: "SETTINGS_UPDATED",
    module: "settings",
    recordId: SETTINGS_KEY,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    previousValue: previous,
    newValue: input,
  });

  return input;
}
