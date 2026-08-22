import { LogIn, LogOut, CalendarPlus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Activity = { id: string; type: "ARRIVAL" | "DEPARTURE" | "NEW_RESERVATION"; time: Date; label: string };

const TYPE_META = {
  ARRIVAL: { icon: LogIn, className: "bg-blue-100 text-blue-600" },
  DEPARTURE: { icon: LogOut, className: "bg-amber-100 text-amber-600" },
  NEW_RESERVATION: { icon: CalendarPlus, className: "bg-emerald-100 text-emerald-600" },
} as const;

export function TodaysActivitiesCard({ activities }: { activities: Activity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Activities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled for today yet.</p>
        ) : (
          activities.map((a) => {
            const meta = TYPE_META[a.type];
            const Icon = meta.icon;
            return (
              <div key={a.id} className="flex items-start gap-3">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.className)}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {a.time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                  <p className="truncate text-sm text-slate-700">{a.label}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
