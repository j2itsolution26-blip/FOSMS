"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const STATUS_META: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: "Available", color: "#16a34a" },
  OCCUPIED: { label: "Occupied", color: "#2563eb" },
  RESERVED: { label: "Reserved", color: "#7c3aed" },
  CLEANING: { label: "Cleaning", color: "#f59e0b" },
  MAINTENANCE: { label: "Maintenance", color: "#ef4444" },
  OUT_OF_ORDER: { label: "Out of Order", color: "#64748b" },
};

export function RoomStatusChart({ total, byStatus }: { total: number; byStatus: Record<string, number> }) {
  const data = Object.entries(byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status,
      label: STATUS_META[status]?.label ?? status,
      color: STATUS_META[status]?.color ?? "#94a3b8",
      count,
    }));

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="label" innerRadius={55} outerRadius={80} paddingAngle={2}>
              {data.map((d) => (
                <Cell key={d.status} fill={d.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [`${value} rooms`, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{total}</span>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
      </div>

      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
              aria-hidden
            />
            <span className="text-slate-700">
              {d.label} <span className="text-muted-foreground">({d.count})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
