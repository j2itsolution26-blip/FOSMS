"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";

type Data = { checkIns: number; checkOuts: number; transfers: number; requests: number };

export function FrontOfficeActivityChart({ data }: { data: Data }) {
  const chartData = [
    { key: "checkIns", label: "Check-ins", value: data.checkIns, color: "#2563eb" },
    { key: "checkOuts", label: "Check-outs", value: data.checkOuts, color: "#f59e0b" },
    { key: "transfers", label: "Room Transfers", value: data.transfers, color: "#7c3aed" },
    { key: "requests", label: "Guest Requests", value: data.requests, color: "#16a34a" },
  ];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }} />
        <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {chartData.map((d) => (
            <Cell key={d.key} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
