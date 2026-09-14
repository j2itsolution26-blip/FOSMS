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
import { ROLE_DISPLAY } from "@/config/role-display";
import {
  changeOwnPasswordSchema,
  resetAccountPasswordSchema,
  type ChangeOwnPasswordInput,
  type ResetAccountPasswordInput,
} from "@/validators/account.schema";

/** The one Trainee / Candidate login, as the server describes it. There is no
 * id here on purpose — the reset endpoint resolves the account itself, so
 * this screen never names a target and cannot be pointed at another user. */
type TraineeAccount = {
  accountName: string;
  roleLabel: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  passwordResetAt: string | null;
  isLocked: boolean;
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
    <InputGroup className="h-10 rounded-lg">
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

/** Label/value line used for read-only account information. */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="shrink-0 text-[13px] font-medium text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium break-words text-slate-900">{children}</span>
    </div>
  );
}

const PASSWORD_RULE = "At least 10 characters, including an uppercase letter, a lowercase letter, and a number.";

/**
 * Supervisor account & password screen.
 *
 * Two sections and nothing else: the Supervisor's own account (with a
 * change-password form that requires the current password), and the single
 * Trainee / Candidate account (with a reset action). Every rule that matters
 * is enforced server-side (see account.service.ts) — this screen only ever
 * collects input, and never receives, stores, or displays an existing
 * password for either account.
 */
export function AccountManagementClient({
  currentUser,
}: {
  currentUser: { name: string; email: string; role: string };
}) {
  const [trainee, setTrainee] = useState<TraineeAccount | null>(null);
  const [loadingTrainee, setLoadingTrainee] = useState(true);
  const [traineeError, setTraineeError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const supervisorDisplay = ROLE_DISPLAY[currentUser.role] ?? ROLE_DISPLAY.SUPERVISOR;

  const ownForm = useForm<ChangeOwnPasswordInput>({
    resolver: zodResolver(changeOwnPasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const resetForm = useForm<ResetAccountPasswordInput>({
    resolver: zodResolver(resetAccountPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const loadTrainee = useCallback(async () => {
    setLoadingTrainee(true);
    const result = await apiFetch<TraineeAccount>("/api/account/trainee");
    if (result.success) {
      setTrainee(result.data);
      setTraineeError(null);
    } else {
      setTrainee(null);
      setTraineeError(result.message);
    }
    setLoadingTrainee(false);
  }, []);

  useEffect(() => {
    loadTrainee();
  }, [loadTrainee]);

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

  function openResetDialog() {
    resetForm.reset({ newPassword: "", confirmPassword: "" });
    setResetOpen(true);
  }

  function handleResetDialogOpenChange(open: boolean) {
    if (resetForm.formState.isSubmitting) return;
    setResetOpen(open);
  }

  async function handleResetPassword(values: ResetAccountPasswordInput) {
    const result = await apiFetch("/api/account/trainee/password", {
      method: "POST",
      body: JSON.stringify(values),
    });

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    setResetOpen(false);
    resetForm.reset({ newPassword: "", confirmPassword: "" });
    toast.success(`${trainee?.accountName ?? "Trainee / Candidate"} password reset successfully.`, {
      description:
        "Give the new password to the trainee directly — it is not shown again, and any session they had was signed out.",
      duration: 8000,
    });
    loadTrainee();
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
            Change your own sign-in password, and reset the Trainee / Candidate password when it is forgotten.
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

      {/* ---------- Section 2: the single Trainee / Candidate account ---------- */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            aria-hidden
          >
            <UserCog className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Trainee / Candidate Account</h2>
            <p className="text-[13px] leading-snug text-slate-500">
              Issue a new password when the trainee is locked out or has forgotten theirs. Only the password
              changes — role, permissions, email, and account status stay exactly as they are.
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          {loadingTrainee ? (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-40" />
                </div>
              ))}
            </div>
          ) : traineeError ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <p className="text-[13px] leading-snug text-amber-900">{traineeError}</p>
            </div>
          ) : trainee ? (
            <div className="space-y-3">
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                <InfoRow label="Account">
                  <span className="inline-flex items-center gap-2">
                    {trainee.accountName}
                    {trainee.isLocked ? (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                        Locked
                      </Badge>
                    ) : null}
                  </span>
                </InfoRow>
                <InfoRow label="Role">{trainee.roleLabel}</InfoRow>
                <InfoRow label="Email">
                  <span className="font-mono text-[13px] text-slate-600">{trainee.email}</span>
                </InfoRow>
                <InfoRow label="Last password change">
                  <span className="text-slate-600">{formatDate(trainee.passwordResetAt)}</span>
                </InfoRow>
                <InfoRow label="Last sign-in">
                  <span className="text-slate-600">{formatDate(trainee.lastLoginAt)}</span>
                </InfoRow>
              </div>

              <div className="flex justify-end border-t border-slate-100 pt-3.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={openResetDialog}
                  className="h-10 w-full shrink-0 gap-2 rounded-lg px-4 text-sm font-medium sm:w-auto"
                >
                  <KeyRound className="h-4 w-4" aria-hidden /> Reset Password
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------- Compact reset confirmation ---------- */}
      <Dialog open={resetOpen} onOpenChange={handleResetDialogOpenChange}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-md">
          <DialogHeader className="shrink-0 gap-0 border-b border-slate-100 px-5 py-3.5 pr-12 text-left">
            <DialogTitle className="flex items-center gap-2.5 text-[15px] text-slate-900">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100"
                aria-hidden
              >
                <KeyRound className="h-4.5 w-4.5" />
              </span>
              Reset Trainee / Candidate Password
            </DialogTitle>
          </DialogHeader>

          <Form {...resetForm}>
            <form
              onSubmit={resetForm.handleSubmit(handleResetPassword)}
              className="flex min-h-0 flex-1 flex-col"
              noValidate
            >
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {/* The account is named unambiguously before any password is
                    typed — this modal never offers a choice of target. */}
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
                  <InfoRow label="Account">{trainee?.accountName ?? "Trainee / Candidate"}</InfoRow>
                  <InfoRow label="Role">{trainee?.roleLabel ?? "Front Office Trainee"}</InfoRow>
                </div>

                <DialogDescription className="text-[13px] leading-snug">
                  Their existing password is never shown and cannot be recovered — this replaces it.
                </DialogDescription>

                <FormField
                  control={resetForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-medium text-slate-700">New Password</FormLabel>
                      <FormControl>
                        <PasswordField
                          label="new password"
                          placeholder="Enter a new password"
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
                      <FormLabel className="text-[13px] font-medium text-slate-700">Confirm New Password</FormLabel>
                      <FormControl>
                        <PasswordField
                          label="password confirmation"
                          placeholder="Re-enter the new password"
                          autoComplete="new-password"
                          disabled={resetForm.formState.isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                  <p className="text-[13px] leading-snug text-amber-900">
                    Give the new password to the trainee directly — it is not shown again afterwards. Any session
                    they currently have is signed out.
                  </p>
                </div>

                <p className="text-xs leading-snug text-slate-500">{PASSWORD_RULE}</p>
              </div>

              <DialogFooter className="m-0 shrink-0 gap-2 border-t border-slate-200 px-5 py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleResetDialogOpenChange(false)}
                  disabled={resetForm.formState.isSubmitting}
                  className="h-10 rounded-lg px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetForm.formState.isSubmitting}
                  className="h-10 gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition-all hover:shadow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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
