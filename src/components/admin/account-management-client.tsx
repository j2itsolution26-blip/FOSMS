"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowRight, KeyRound, Loader2, ShieldCheck, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiFetch } from "@/lib/api-client";
import { ROLE_DISPLAY } from "@/config/role-display";
import { changeOwnPasswordSchema, type ChangeOwnPasswordInput } from "@/validators/account.schema";
import { InfoRow, PASSWORD_RULE, PasswordField } from "@/components/admin/password-fields";

/**
 * Supervisor account & password screen.
 *
 * The Supervisor's own account (with a change-password form that requires
 * the current password) and a pointer to Staff / Accounts, where each Front
 * Desk trainee login is reset / activated / deactivated. Every rule that matters
 * is enforced server-side (see account.service.ts) — this screen only ever
 * collects input, and never receives, stores, or displays an existing
 * password for either account.
 */
export function AccountManagementClient({
  currentUser,
}: {
  currentUser: { name: string; email: string; role: string };
}) {
  const supervisorDisplay = ROLE_DISPLAY[currentUser.role] ?? ROLE_DISPLAY.SUPERVISOR;

  const ownForm = useForm<ChangeOwnPasswordInput>({
    resolver: zodResolver(changeOwnPasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function handleChangeOwnPassword(values: ChangeOwnPasswordInput) {
    const result = await apiFetch("/api/account/password", { method: "POST", body: JSON.stringify(values) });

    if (!result.success) {
      // A wrong current password is a field-level problem, not a page-level
      // one — surfaced on the field itself so the Supervisor doesn't have to
      // guess which of the three inputs was rejected.
      if (result.code === "INVALID_CURRENT_PASSWORD") {
        ownForm.setError("currentPassword", { message: result.message });
      }
      toast.error(result.message);
      return;
    }

    ownForm.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
    toast.success("Your password was changed successfully.", {
      description:
        "You are still signed in on this device. Any other device signed in to your account was signed out.",
      duration: 8000,
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <header className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100"
          aria-hidden
        >
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Account &amp; Password</h1>
          <p className="text-[13px] leading-snug text-slate-500">
            Change your own sign-in password. Trainee passwords are reset from Staff / Accounts.
            Existing passwords are never shown — they are stored only as a hash and can be replaced, never read.
          </p>
        </div>
      </header>

      {/* ---------- Section 1: My Account ---------- */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100"
            aria-hidden
          >
            <KeyRound className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">My Account</h2>
            <p className="text-[13px] leading-snug text-slate-500">
              Your own Supervisor sign-in. Changing it requires your current password.
            </p>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            <InfoRow label="Account">{currentUser.name}</InfoRow>
            <InfoRow label="Role">{supervisorDisplay.subtitle}</InfoRow>
            <InfoRow label="Email">
              <span className="font-mono text-[13px] text-slate-600">{currentUser.email}</span>
            </InfoRow>
          </div>

          <Form {...ownForm}>
            <form onSubmit={ownForm.handleSubmit(handleChangeOwnPassword)} className="space-y-3" noValidate>
              <h3 className="text-sm font-semibold text-slate-900">Change Password</h3>

              <FormField
                control={ownForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[13px] font-medium text-slate-700">Current Password</FormLabel>
                    <FormControl>
                      <PasswordField
                        label="current password"
                        placeholder="Enter your current password"
                        autoComplete="current-password"
                        disabled={ownForm.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={ownForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium text-slate-700">New Password</FormLabel>
                      <FormControl>
                        <PasswordField
                          label="new password"
                          placeholder="Enter a new password"
                          autoComplete="new-password"
                          disabled={ownForm.formState.isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ownForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium text-slate-700">Confirm New Password</FormLabel>
                      <FormControl>
                        <PasswordField
                          label="password confirmation"
                          placeholder="Re-enter the new password"
                          autoComplete="new-password"
                          disabled={ownForm.formState.isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-snug text-slate-500">{PASSWORD_RULE}</p>
                <Button
                  type="submit"
                  disabled={ownForm.formState.isSubmitting}
                  className="h-10 w-full shrink-0 gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition-all hover:shadow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {ownForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Updating…
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" aria-hidden /> Update Password
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </section>

      {/* ---------- Section 2: trainee logins now live in Staff / Accounts ---------- */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200"
              aria-hidden
            >
              <UserCog className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Front Office Trainee Accounts</h2>
              <p className="text-[13px] leading-snug text-slate-500">
                Reset a trainee&apos;s password, or activate / deactivate Front Desk A–O, from Staff / Accounts.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-10 w-full shrink-0 gap-2 rounded-lg px-4 text-sm font-medium sm:w-auto">
            <Link href="/admin/staff">
              Open Staff / Accounts <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
