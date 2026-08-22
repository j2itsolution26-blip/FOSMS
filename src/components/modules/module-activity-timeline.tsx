import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ModuleActivityItem } from "@/components/modules/types";

export function ModuleActivityTimeline({
  title = "Recent Activity",
  items,
  emptyText = "No activity recorded yet for this period.",
}: {
  title?: string;
  items: ModuleActivityItem[];
  emptyText?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex items-start gap-3">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", item.tone)}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                  <p className="truncate text-sm text-slate-700">{item.label}</p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
