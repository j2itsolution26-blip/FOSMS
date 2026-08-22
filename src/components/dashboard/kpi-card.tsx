import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_STYLES = {
  blue: { bg: "bg-blue-50", text: "text-blue-700", iconBg: "bg-blue-100 text-blue-600" },
  green: { bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100 text-emerald-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", iconBg: "bg-amber-100 text-amber-600" },
  purple: { bg: "bg-violet-50", text: "text-violet-700", iconBg: "bg-violet-100 text-violet-600" },
} as const;

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  unit: string;
  icon: LucideIcon;
  tone: keyof typeof TONE_STYLES;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div className={cn("rounded-xl border p-4 sm:p-5", styles.bg)}>
      <div className="flex items-start justify-between">
        <p className={cn("text-sm font-medium", styles.text)}>{label}</p>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", styles.iconBg)}>
          <Icon className="h-4.5 w-4.5" aria-hidden />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-muted-foreground">{unit}</p>
    </div>
  );
}
