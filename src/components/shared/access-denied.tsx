import { ShieldAlert } from "lucide-react";

export function AccessDenied() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <ShieldAlert className="h-6 w-6" aria-hidden />
      </div>
      <div>
        <p className="font-semibold text-slate-900">You don&apos;t have access to this page</p>
        <p className="text-sm text-muted-foreground">Contact an administrator if you believe this is a mistake.</p>
      </div>
    </div>
  );
}
