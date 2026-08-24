import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginBrandingPanel } from "./branding-panel";
import { LoginFooter } from "./login-footer";
import { LoginForm } from "./login-form";
import { BrandCrest } from "./brand-crest";
import { TesdaBadge } from "./tesda-badge";

export const metadata: Metadata = { title: "Sign in — Front Office Servicing NC II" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-[#F8FAFC] lg:h-screen lg:overflow-hidden">
      <TesdaBadge />
      <LoginBrandingPanel />

      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-[440px]">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <BrandCrest />
              <div>
                <p className="text-sm font-bold tracking-wide text-[#0B1F44]">FRONT OFFICE SERVICING NC II</p>
                <p className="text-xs text-[#64748B]">Training & Operations Management System</p>
              </div>
            </div>

            <div className="mb-6 text-center">
              <h1 className="text-[26px] leading-tight font-bold text-[#172033] sm:text-[28px]">Welcome back!</h1>
              <p className="mt-1 text-sm text-[#64748B]">Sign in to continue to your account.</p>
            </div>

            <Suspense>
              <LoginForm />
            </Suspense>
          </div>

          <LoginFooter />
        </div>
      </div>
    </div>
  );
}
