import type { Metadata } from "next";
import { Suspense } from "react";
import { BedDouble } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — Front Office Servicing NC II" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0b1c3f] text-amber-400">
            <BedDouble className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-bold tracking-wide text-[#0b1c3f]">FRONT OFFICE SERVICING NC II</p>
            <p className="text-xs text-muted-foreground">Training & Operations Management System</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
