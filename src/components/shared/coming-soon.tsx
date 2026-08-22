import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

export function ComingSoon({
  title,
  description,
  icon: Icon = Construction,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-white text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <p className="font-semibold text-slate-900">This module is on the roadmap</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {title} is planned for a later phase of the Front Office Servicing NC II system. The data model already
          supports it — the workflow and UI are coming next.
        </p>
      </div>
    </div>
  );
}
