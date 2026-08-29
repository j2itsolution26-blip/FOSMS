"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RoomStatus } from "@prisma/client";

import { ROOM_STATUS_CATEGORY_META, roomStatusCategory, roomStatusLabel } from "@/config/room-status";

export function RoomStatusChart({ total, byStatus }: { total: number; byStatus: Record<string, number> }) {
  const data = Object.entries(byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status,
      label: roomStatusLabel(status as RoomStatus),
      color: ROOM_STATUS_CATEGORY_META[roomStatusCategory(status as RoomStatus)].color,
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
