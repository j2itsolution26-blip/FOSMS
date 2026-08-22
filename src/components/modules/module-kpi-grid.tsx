import { KpiCard } from "@/components/dashboard/kpi-card";
import type { ModuleKpi } from "@/components/modules/types";

export function ModuleKpiGrid({ kpis }: { kpis: ModuleKpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} unit={kpi.unit} icon={kpi.icon} tone={kpi.tone} />
      ))}
    </div>
  );
}
