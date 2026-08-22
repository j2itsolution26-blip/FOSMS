"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Data = { competent: number; notYetCompetent: number; pending: number };

const SLICES = [
  { key: "competent", label: "Competent", color: "#16a34a" },
  { key: "notYetCompetent", label: "Not Yet Competent", color: "#dc2626" },
  { key: "pending", label: "Pending", color: "#94a3b8" },
] as const;

export function AssessmentResultsChart({ data }: { data: Data }) {
  const total = data.competent + data.notYetCompetent + data.pending;
  const chartData = SLICES.map((s) => ({ ...s, value: data[s.key] })).filter((s) => s.value > 0);

  if (total === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No assessments recorded yet.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={55} outerRadius={80} paddingAngle={2}>
              {chartData.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [`${value} assessments`, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{total}</span>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-1 gap-2 text-sm">
        {SLICES.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="text-slate-700">
              {s.label} <span className="text-muted-foreground">({data[s.key]})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
