"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

type TrendRow = { date: string; label: string; revenue: number; transactionCount: number };

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// Revenue (currency) and Transaction Count (integer) are different scales — a
// dual-axis chart would misrepresent their relationship, so this is a single
// metric at a time behind a toggle, never both series on one plot at once.
export function RevenueTransactionsChart({ data }: { data: TrendRow[] }) {
  const [metric, setMetric] = useState<"revenue" | "transactionCount">("revenue");

  const hasData = data.some((d) => (metric === "revenue" ? d.revenue !== 0 : d.transactionCount !== 0));

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setMetric("revenue")}
          className={cn(
            "rounded px-3 py-1 font-medium transition-colors",
            metric === "revenue" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Revenue
        </button>
        <button
          type="button"
          onClick={() => setMetric("transactionCount")}
          className={cn(
            "rounded px-3 py-1 font-medium transition-colors",
            metric === "transactionCount" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Transaction Count
        </button>
      </div>

      {!hasData ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No data available</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tickFormatter={(v) => (metric === "revenue" ? currency(v) : String(v))}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
              formatter={(value) => [metric === "revenue" ? currency(Number(value)) : value, metric === "revenue" ? "Revenue" : "Transactions"]}
            />
            <Bar dataKey={metric} name={metric === "revenue" ? "Revenue" : "Transactions"} fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
