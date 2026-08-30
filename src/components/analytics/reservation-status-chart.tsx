"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList } from "recharts";

type StatusRow = { status: string; count: number };

// Same identity colors as ReservationStatusBadge (status-badge.tsx) so a status
// reads the same color everywhere in the app. Cancelled/No-Show both signal a
// lost booking but get distinct hues — two different series can't share a color.
const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "#d97706" },
  CONFIRMED: { label: "Confirmed", color: "#2563eb" },
  CHECKED_IN: { label: "Checked-In", color: "#16a34a" },
  CHECKED_OUT: { label: "Checked-Out", color: "#64748b" },
  CANCELLED: { label: "Cancelled", color: "#dc2626" },
  NO_SHOW: { label: "No-Show", color: "#f43f5e" },
};

export function ReservationStatusChart({ data }: { data: StatusRow[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No data available</p>;
  }

  const chartData = data.map((d) => ({
    ...d,
    label: STATUS_META[d.status]?.label ?? d.status,
    color: STATUS_META[d.status]?.color ?? "#94a3b8",
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12, fill: "#334155" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }} formatter={(value) => [value, "Reservations"]} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {chartData.map((d) => (
            <Cell key={d.status} fill={d.color} />
          ))}
          <LabelList dataKey="count" position="right" style={{ fill: "#334155", fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
