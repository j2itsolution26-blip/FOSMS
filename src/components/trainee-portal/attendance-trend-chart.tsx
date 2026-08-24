"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CalendarRange } from "lucide-react";

export type AttendanceRow = { date: string | Date; status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" };

type WeekBucket = { label: string; present: number; late: number; absent: number; excused: number };

const WEEKS_SHOWN = 12;

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function buildWeeklyBuckets(rows: AttendanceRow[]): WeekBucket[] {
  const today = startOfWeek(new Date());
  const weekStarts: Date[] = [];
  for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
    weekStarts.push(new Date(today.getTime() - i * 7 * 24 * 60 * 60 * 1000));
  }

  const buckets = new Map<string, WeekBucket>();
  for (const start of weekStarts) {
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const label =
      start.getMonth() === end.getMonth()
        ? `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.getDate()}`
        : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    buckets.set(start.toISOString(), { label, present: 0, late: 0, absent: 0, excused: 0 });
  }

  for (const row of rows) {
    const weekKey = startOfWeek(new Date(row.date)).toISOString();
    const bucket = buckets.get(weekKey);
    if (!bucket) continue; // outside the displayed window
    if (row.status === "PRESENT") bucket.present += 1;
    else if (row.status === "LATE") bucket.late += 1;
    else if (row.status === "ABSENT") bucket.absent += 1;
    else if (row.status === "EXCUSED") bucket.excused += 1;
  }

  return Array.from(buckets.values());
}

export function AttendanceTrendChart({ rows }: { rows: AttendanceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
        <CalendarRange className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-slate-900">Not enough attendance history yet</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Your attendance trend will appear here once records start coming in.
        </p>
      </div>
    );
  }

  const data = buildWeeklyBuckets(rows);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="present" name="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
        <Bar dataKey="late" name="Late" stackId="a" fill="#f59e0b" />
        <Bar dataKey="absent" name="Absent" stackId="a" fill="#ef4444" />
        <Bar dataKey="excused" name="Excused" stackId="a" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
