"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";

type ByType = { type: string; amount: number; count: number };
type ByMethod = { method: string | null; amount: number };

const TYPE_META: Record<string, { label: string; color: string }> = {
  CHARGE: { label: "Charges", color: "#f59e0b" },
  PAYMENT: { label: "Payments", color: "#16a34a" },
  REFUND: { label: "Refunds", color: "#dc2626" },
  DISCOUNT: { label: "Discounts", color: "#2563eb" },
};

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function CashieringChart({ byType, byMethod }: { byType: ByType[]; byMethod: ByMethod[] }) {
  const chartData = byType.map((d) => ({
    ...d,
    label: TYPE_META[d.type]?.label ?? d.type,
    color: TYPE_META[d.type]?.color ?? "#94a3b8",
  }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => currency(v)} />
          <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }} formatter={(value) => [currency(Number(value)), "Amount"]} />
          <Bar dataKey="amount" name="Amount" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {chartData.map((d) => (
              <Cell key={d.type} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {byMethod.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Payments by Method</p>
          <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {byMethod.map((m) => (
              <li key={m.method} className="rounded-md bg-slate-50 p-2 text-center">
                <p className="font-semibold text-slate-900">{currency(m.amount)}</p>
                <p className="text-xs text-muted-foreground">{m.method?.replaceAll("_", " ") ?? "Other"}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
