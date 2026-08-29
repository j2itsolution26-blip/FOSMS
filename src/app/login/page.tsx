import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";

import { LoginBrandingPanel } from "./branding-panel";
import { LoginFooter } from "./login-footer";
import { LoginForm } from "./login-form";
import { LoginMobileHero } from "./mobile-hero";
import { TesdaBadge } from "./tesda-badge";

export const metadata: Metadata = { title: "Sign in — Front Office Servicing NC II" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] md:h-screen md:flex-row md:overflow-hidden">
      <TesdaBadge />
      <LoginMobileHero />
      <LoginBrandingPanel />

      <div className="flex flex-1 flex-col items-center justify-start overflow-y-auto px-4 py-8 sm:px-6 md:justify-center md:py-10 lg:px-10">
        <div className="w-full max-w-[440px]">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <Image src="/images/asian-college-logo.png" alt="Asian College of Science and Technology" width={64} height={64} className="h-16 w-16" priority />
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
