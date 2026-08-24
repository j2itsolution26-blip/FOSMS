import type { Metadata } from "next";
import { Suspense } from "react";

import { BrandCrest } from "@/app/login/brand-crest";
import { LoginFooter } from "@/app/login/login-footer";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Reset Password — Front Office Servicing NC II" };

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <BrandCrest size="sm" />
            <div>
              <p className="text-sm font-bold tracking-wide text-[#0B1F44]">FRONT OFFICE SERVICING NC II</p>
              <p className="text-xs text-[#64748B]">Training & Operations Management System</p>
            </div>
          </div>

          <div className="mb-6 text-center">
            <h1 className="text-[24px] leading-tight font-bold text-[#172033]">Set a new password</h1>
            <p className="mt-1 text-sm text-[#64748B]">Choose a strong password for your account.</p>
          </div>

          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </div>

        <LoginFooter />
      </div>
    </div>
  );
}
