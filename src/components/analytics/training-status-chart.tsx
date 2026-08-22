"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";

type Datum = { status: string; count: number };

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "#16a34a" },
  ON_HOLD: { label: "On Hold", color: "#f59e0b" },
  COMPLETED: { label: "Completed", color: "#2563eb" },
  WITHDRAWN: { label: "Withdrawn", color: "#64748b" },
  SUSPENDED: { label: "Suspended", color: "#dc2626" },
  GRADUATED: { label: "Graduated", color: "#7c3aed" },
};

export function TrainingStatusChart({ data }: { data: Datum[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: STATUS_META[d.status]?.label ?? d.status,
    color: STATUS_META[d.status]?.color ?? "#94a3b8",
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }} formatter={(value) => [`${value} trainees`, ""]} />
        <Bar dataKey="count" name="Trainees" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {chartData.map((d) => (
            <Cell key={d.status} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
