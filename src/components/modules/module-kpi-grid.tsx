import { KpiCard } from "@/components/dashboard/kpi-card";
import type { ModuleKpi } from "@/components/modules/types";
import { cn } from "@/lib/utils";

export function ModuleKpiGrid({ kpis }: { kpis: ModuleKpi[] }) {
  const gridCols =
    kpis.length <= 2
      ? "grid-cols-1 sm:grid-cols-2"
      : kpis.length === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : "grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("grid gap-4", gridCols)}>
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} unit={kpi.unit} icon={kpi.icon} tone={kpi.tone} />
      ))}
    </div>
  );
}
