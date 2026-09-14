"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck, UserCog } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { apiFetch } from "@/lib/api-client";
import {
  changeOwnPasswordSchema,
  resetAccountPasswordSchema,
  type ChangeOwnPasswordInput,
  type ResetAccountPasswordInput,
} from "@/validators/account.schema";

type ManagedAccount = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  passwordResetAt: string | null;
  studentNumber: string | null;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { dateStyle: "medium" }) : "Never";
}

/** One password field with a show/hide toggle — same InputGroup composition
 * the sign-in and reset-password screens already use, so this page reads as
 * part of the same system rather than a bolted-on form. */
function PasswordField({
  label,
  placeholder,
  autoComplete,
  value,
  onChange,
  onBlur,
  name,
  disabled,
  ref,
}: {
  label: string;
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (...event: unknown[]) => void;
  onBlur: () => void;
  name: string;
  disabled?: boolean;
  /** Forwarded from react-hook-form's field so a failed validation can focus
   * the offending input (React 19 passes `ref` as an ordinary prop). */
  ref?: React.Ref<HTMLInputElement>;
}) {
  const [show, setShow] = useState(false);

  return (
    <InputGroup className="h-11 rounded-xl">
      <InputGroupAddon>
        <Lock aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        ref={ref}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          size="icon-sm"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

/**
 * Supervisor account management: change your own password, and issue a new
 * temporary password for a trainee login. Every rule that matters is enforced
 * server-side (see account.service.ts) — this screen only ever collects input
 * and never receives, stores, or displays an existing password.
 */
export function AccountManagementClient({ currentUser }: { currentUser: { name: string; email: string } }) {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [resetTarget, setResetTarget] = useState<ManagedAccount | null>(null);

  const ownForm = useForm<ChangeOwnPasswordInput>({
    resolver: zodResolver(changeOwnPasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const resetForm = useForm<ResetAccountPasswordInput>({
    resolver: zodResolver(resetAccountPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    const result = await apiFetch<ManagedAccount[]>("/api/account/managed-accounts");
    if (result.success) setAccounts(result.data);
    setLoadingAccounts(false);
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

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
      description: "You are still signed in on this device. Any other device signed in to your account was signed out.",
      duration: 8000,
    });
  }

  function openResetDialog(account: ManagedAccount) {
    resetForm.reset({ newPassword: "", confirmPassword: "" });
    setResetTarget(account);
  }

  function handleResetDialogOpenChange(open: boolean) {
    if (resetForm.formState.isSubmitting) return;
    if (!open) setResetTarget(null);
  }

  async function handleResetPassword(values: ResetAccountPasswordInput) {
    if (!resetTarget) return;

    const result = await apiFetch(`/api/account/managed-accounts/${resetTarget.id}/password`, {
      method: "POST",
      body: JSON.stringify(values),
    });

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    const name = `${resetTarget.firstName} ${resetTarget.lastName}`;
    setResetTarget(null);
    resetForm.reset({ newPassword: "", confirmPassword: "" });
    toast.success(`Password reset for ${name}.`, {
      description: "Give them the new temporary password directly — it is not shown again, and any session they had was signed out.",
      duration: 8000,
    });
    loadAccounts();
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100"
          aria-hidden
        >
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Account &amp; Password</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
            Change your own sign-in password and issue a new temporary password for a trainee account. Existing
            passwords are never shown — they are stored only as a hash and can be replaced, never read.
          </p>
        </div>
      </header>

      {/* ---------- Change my own password ---------- */}
      <section className="max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3.5 border-b border-slate-100 px-6 py-5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100"
            aria-hidden
          >
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">My Password</h2>
            <p className="text-sm leading-relaxed text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{currentUser.name}</span> ·{" "}
              <span className="font-mono text-xs text-slate-500">{currentUser.email}</span>
            </p>
          </div>
        </div>

        <Form {...ownForm}>
          <form onSubmit={ownForm.handleSubmit(handleChangeOwnPassword)} className="space-y-4 px-6 py-5" noValidate>
            <FormField
              control={ownForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-slate-700">Current Password</FormLabel>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={ownForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">New Password</FormLabel>
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
                    <FormLabel className="text-sm font-medium text-slate-700">Confirm New Password</FormLabel>
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

            <p className="text-xs leading-relaxed text-slate-500">
              At least 10 characters, including an uppercase letter, a lowercase letter, and a number.
            </p>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button
                type="submit"
                disabled={ownForm.formState.isSubmitting}
                className="h-11 w-full gap-2 rounded-xl px-5 font-semibold shadow-sm transition-all hover:shadow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
      </section>

      {/* ---------- Trainee accounts ---------- */}
      <section className="max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3.5 border-b border-slate-100 px-6 py-5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            aria-hidden
          >
            <UserCog className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Trainee Accounts</h2>
            <p className="text-sm leading-relaxed text-slate-500">
              Issue a new temporary password when a trainee is locked out or has forgotten theirs. Only the password
              changes — role, permissions, email, and account status stay exactly as they are.
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
          {loadingAccounts ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3.5 last:border-b-0"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-9 w-32 rounded-lg" />
                </div>
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              There are no trainee accounts to manage.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-medium text-slate-900">
                        {account.firstName} {account.lastName}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          account.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                        }
                      >
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {account.studentNumber ? (
                        <span className="font-mono text-xs text-slate-500">{account.studentNumber}</span>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-slate-500">{account.email}</p>
                    <p className="text-xs text-slate-400">
                      Last password change: {formatDate(account.passwordResetAt)} · Last sign-in:{" "}
                      {formatDate(account.lastLoginAt)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openResetDialog(account)}
                    className="h-10 w-full shrink-0 gap-2 rounded-lg px-4 font-medium sm:w-auto"
                  >
                    <KeyRound className="h-4 w-4" aria-hidden /> Reset Password
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Reset dialog ---------- */}
      <Dialog open={!!resetTarget} onOpenChange={handleResetDialogOpenChange}>
        {/* Bounded flex column so the header and footer stay put and only the
            middle scrolls on a short window — same structure as the other
            modals in this section. */}
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-md">
          <DialogHeader className="shrink-0 gap-0 border-b border-slate-100 px-5 py-4 pr-12 text-left">
            <DialogTitle className="flex items-center gap-2.5 text-slate-900">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100"
                aria-hidden
              >
                <KeyRound className="h-4.5 w-4.5" />
              </span>
              Reset Password
            </DialogTitle>
          </DialogHeader>

          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="flex min-h-0 flex-1 flex-col" noValidate>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                <DialogDescription className="leading-relaxed">
                  Set a new temporary password for{" "}
                  <span className="font-medium text-slate-700">
                    {resetTarget ? `${resetTarget.firstName} ${resetTarget.lastName}` : ""}
                  </span>{" "}
                  ({resetTarget?.email}). Their existing password is never shown and cannot be recovered — this
                  replaces it.
                </DialogDescription>

                <FormField
                  control={resetForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700">New Temporary Password</FormLabel>
                      <FormControl>
                        <PasswordField
                          label="new temporary password"
                          placeholder="Enter a temporary password"
                          autoComplete="new-password"
                          disabled={resetForm.formState.isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={resetForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700">Confirm Password</FormLabel>
                      <FormControl>
                        <PasswordField
                          label="password confirmation"
                          placeholder="Re-enter the temporary password"
                          autoComplete="new-password"
                          disabled={resetForm.formState.isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm leading-relaxed text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    Give the new password to the trainee directly — it is not shown again afterwards. Any session
                    they currently have is signed out.
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-500">
                  At least 10 characters, including an uppercase letter, a lowercase letter, and a number.
                </p>
              </div>

              <DialogFooter className="m-0 shrink-0 gap-2 border-t border-slate-200 px-5 py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleResetDialogOpenChange(false)}
                  disabled={resetForm.formState.isSubmitting}
                  className="h-11 rounded-xl px-5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetForm.formState.isSubmitting}
                  className="h-11 gap-2 rounded-xl px-5 font-semibold shadow-sm transition-all hover:shadow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Resetting…
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" aria-hidden /> Reset Password
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
