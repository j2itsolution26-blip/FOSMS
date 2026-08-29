"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ModuleQuickAction } from "@/components/modules/types";

export function ModuleQuickActions({ actions }: { actions: ModuleQuickAction[] }) {
  if (actions.length === 0) return null;

  const gridCols =
    actions.length <= 3
      ? "grid-cols-1 sm:grid-cols-3"
      : actions.length === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : actions.length === 5
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-3", gridCols)}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 text-center text-sm font-medium transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100",
                  action.tone
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {action.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
