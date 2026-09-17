"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  AlertTriangle,
  FlaskConical,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Power,
  PowerOff,
  RefreshCw,
  UserRound,
} from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { resetAccountPasswordSchema, type ResetAccountPasswordInput } from "@/validators/account.schema";
import { InfoRow, PASSWORD_RULE, PasswordField } from "@/components/admin/password-fields";
import { AccountLabResetDialog } from "@/components/admin/account-lab-reset-dialog";

type StaffAccountStatus = "ACTIVE" | "DEACTIVATED";

type StaffAccount = {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  status: StaffAccountStatus;
  lastLoginAt: string | null;
  isLocked: boolean;
};

type StaffAccountList = { accounts: StaffAccount[]; missing: string[] };

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { dateStyle: "medium" }) : "Never";
}

function StatusBadge({ status }: { status: StaffAccountStatus }) {
  const active = status === "ACTIVE";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium",
        active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-red-500")} aria-hidden />
      {active ? "Active" : "Deactivated"}
    </Badge>
  );
}

function AccountActions({
  account,
  onReset,
  onLabReset,
  onToggle,
}: {
  account: StaffAccount;
  onReset: () => void;
  onLabReset: () => void;
  onToggle: () => void;
}) {
  const active = account.status === "ACTIVE";
  const toggleClass = active
    ? "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800";
  return (
    <>
      {/* Wide screens: every action inline. */}
      <div className="hidden flex-nowrap items-center justify-end gap-2 xl:flex">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onReset}>
          <KeyRound className="h-3.5 w-3.5" aria-hidden /> Reset Password
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          onClick={onLabReset}
          aria-label={`Reset laboratory data for ${account.name}`}
        >
          <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Reset Laboratory Data
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("min-w-[7.5rem] gap-1.5", toggleClass)}
          onClick={onToggle}
          aria-label={`${active ? "Deactivate" : "Activate"} ${account.name}`}
        >
          {active ? <PowerOff className="h-3.5 w-3.5" aria-hidden /> : <Power className="h-3.5 w-3.5" aria-hidden />}
          {active ? "Deactivate" : "Activate"}
        </Button>
      </div>

      {/* Narrower screens: the same three actions in a compact menu. */}
      <div className="flex justify-end xl:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="gap-1.5" aria-label={`Actions for ${account.name}`}>
              <MoreHorizontal className="h-4 w-4" aria-hidden /> Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={onReset}>
              <KeyRound className="h-4 w-4" aria-hidden /> Reset Password
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onLabReset} className="text-red-700 focus:bg-red-50 focus:text-red-800">
              <FlaskConical className="h-4 w-4 text-red-600" aria-hidden /> Reset Laboratory Data
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onToggle}
              className={active ? "text-red-700 focus:bg-red-50 focus:text-red-800" : "text-emerald-700 focus:bg-emerald-50 focus:text-emerald-800"}
            >
              {active ? <PowerOff className="h-4 w-4" aria-hidden /> : <Power className="h-4 w-4" aria-hidden />}
              {active ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

/**
 * Supervisor-only management of the Front Desk A–O trainee logins: real
 * activation/deactivation (enforced at sign-in and on every authenticated
 * request) and per-account password resets. Deactivating never deletes any
 * of the account's operational records.
 */
export function StaffAccountsClient() {
  const [data, setData] = useState<StaffAccountList | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<StaffAccount | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<StaffAccount | null>(null);
  const [labResetTarget, setLabResetTarget] = useState<StaffAccount | null>(null);

  const resetForm = useForm<ResetAccountPasswordInput>({
    resolver: zodResolver(resetAccountPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<StaffAccountList>("/api/staff-accounts");
    if (result.success) {
      setData(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function replaceAccount(next: StaffAccount) {
    setData((prev) => (prev ? { ...prev, accounts: prev.accounts.map((a) => (a.id === next.id ? next : a)) } : prev));
  }

  async function confirmStatusChange() {
    if (!statusTarget) return;
    const nextStatus: StaffAccountStatus = statusTarget.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
    setStatusBusy(true);
    const result = await apiFetch<StaffAccount>(`/api/staff-accounts/${statusTarget.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    setStatusBusy(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    replaceAccount(result.data);
    setStatusTarget(null);
    toast.success(
      nextStatus === "DEACTIVATED"
        ? `${result.data.name} has been deactivated and signed out.`
        : `${result.data.name} can sign in again.`
    );
  }

  function openReset(account: StaffAccount) {
    resetForm.reset({ newPassword: "", confirmPassword: "" });
    setResetTarget(account);
  }

  function handleResetOpenChange(open: boolean) {
    if (resetForm.formState.isSubmitting) return;
    if (!open) setResetTarget(null);
  }

  async function handleResetPassword(values: ResetAccountPasswordInput) {
    if (!resetTarget) return;
    const result = await apiFetch<StaffAccount>(`/api/staff-accounts/${resetTarget.id}/password`, {
      method: "POST",
      body: JSON.stringify(values),
    });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    replaceAccount(result.data);
    setResetTarget(null);
    resetForm.reset({ newPassword: "", confirmPassword: "" });
    toast.success(`${result.data.name} password reset successfully.`, {
      description:
        result.data.status === "DEACTIVATED"
          ? "The account is still deactivated — activate it before the trainee can sign in."
          : "Give the new password to the trainee directly — it is not shown again, and any session they had was signed out.",
      duration: 8000,
    });
  }

  const accounts = data?.accounts ?? [];
  const activeCount = accounts.filter((a) => a.status === "ACTIVE").length;
  const deactivating = statusTarget?.status === "ACTIVE";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100"
            aria-hidden
          >
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Staff / Accounts</h1>
            <p className="text-[13px] leading-snug text-slate-500">
              Manage Front Office trainee accounts and control access for each class section.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 self-start" onClick={load} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden /> Refresh
        </Button>
      </header>

      {data && data.missing.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <p className="text-[13px] leading-snug text-amber-900">
            {data.missing.length === 1 ? "This account has" : "These accounts have"} not been created yet:{" "}
            <span className="font-medium">{data.missing.join(", ")}</span>.
          </p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-3">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Front Office Trainee Accounts</h2>
          {data ? (
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-emerald-700">{activeCount} active</span> ·{" "}
              <span className="font-semibold text-red-700">{accounts.length - activeCount} deactivated</span>
            </p>
          ) : null}
        </div>

        {loading && !data ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <p className="px-5 py-6 text-sm text-red-700">{loadError}</p>
        ) : accounts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No Front Office trainee accounts exist yet.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Staff</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sign-In</TableHead>
                    <TableHead className="pr-5 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a) => (
                    <TableRow key={a.id} className={cn(a.status === "DEACTIVATED" && "bg-slate-50/60")}>
                      <TableCell className="pl-5 font-medium text-slate-900">
                        <span className="inline-flex items-center gap-2">
                          {a.name}
                          {a.isLocked ? (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                              Locked
                            </Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-[13px] text-slate-600">{a.email}</TableCell>
                      <TableCell className="text-slate-600">{a.roleLabel}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell className="text-slate-600">{formatDate(a.lastLoginAt)}</TableCell>
                      <TableCell className="pr-5">
                        <AccountActions
                          account={a}
                          onReset={() => openReset(a)}
                          onLabReset={() => setLabResetTarget(a)}
                          onToggle={() => setStatusTarget(a)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {accounts.map((a) => (
                <li key={a.id} className="space-y-2.5 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{a.name}</p>
                      <p className="truncate font-mono text-xs text-slate-600">{a.email}</p>
                      <p className="text-xs text-slate-500">
                        {a.roleLabel} · Last sign-in {formatDate(a.lastLoginAt)}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <AccountActions
                          account={a}
                          onReset={() => openReset(a)}
                          onLabReset={() => setLabResetTarget(a)}
                          onToggle={() => setStatusTarget(a)}
                        />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="text-xs leading-snug text-slate-500">
        Deactivating an account only blocks sign-in and signs the trainee out. Their guests, reservations, folios,
        cashiering transactions, special requests, memberships and activity history are kept. Reset Laboratory Data is a
        separate action that clears only that account&apos;s test data and never changes the account itself.
      </p>

      {/* ---------- Activate / deactivate confirmation ---------- */}
      <Dialog open={!!statusTarget} onOpenChange={(o) => !o && !statusBusy && setStatusTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deactivating ? "Deactivate" : "Activate"} {statusTarget?.name}?
            </DialogTitle>
            <DialogDescription>
              {deactivating
                ? `${statusTarget?.name} will no longer be able to sign in until this account is activated again.`
                : `${statusTarget?.name} will be able to sign in again.`}
            </DialogDescription>
          </DialogHeader>
          {deactivating ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Anyone currently signed in with this account is signed out immediately. No records are deleted.
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusTarget(null)} disabled={statusBusy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={deactivating ? "destructive" : "default"}
              onClick={confirmStatusChange}
              disabled={statusBusy}
            >
              {statusBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {deactivating ? "Deactivate Account" : "Activate Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Reset one account's laboratory data ---------- */}
      <AccountLabResetDialog account={labResetTarget} onOpenChange={(open) => !open && setLabResetTarget(null)} />

      {/* ---------- Reset password ---------- */}
      <Dialog open={!!resetTarget} onOpenChange={handleResetOpenChange}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-md">
          <DialogHeader className="shrink-0 gap-0 border-b border-slate-100 px-5 py-3.5 pr-12 text-left">
            <DialogTitle className="flex items-center gap-2.5 text-[15px] text-slate-900">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100"
                aria-hidden
              >
                <KeyRound className="h-4.5 w-4.5" />
              </span>
              Reset Password — {resetTarget?.name}
            </DialogTitle>
          </DialogHeader>

          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="flex min-h-0 flex-1 flex-col" noValidate>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
                  <InfoRow label="Account">{resetTarget?.name}</InfoRow>
                  <InfoRow label="Email">
                    <span className="font-mono text-[13px] text-slate-600">{resetTarget?.email}</span>
                  </InfoRow>
                  <InfoRow label="Status">{resetTarget ? <StatusBadge status={resetTarget.status} /> : null}</InfoRow>
                </div>

                <DialogDescription className="text-[13px] leading-snug">
                  Their existing password is never shown and cannot be recovered — this replaces it. The account&apos;s
                  status does not change.
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

                <p className="text-xs leading-snug text-slate-500">{PASSWORD_RULE}</p>
              </div>

              <DialogFooter className="m-0 shrink-0 gap-2 border-t border-slate-200 px-5 py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleResetOpenChange(false)}
                  disabled={resetForm.formState.isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={resetForm.formState.isSubmitting} className="gap-2">
                  {resetForm.formState.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <KeyRound className="h-4 w-4" aria-hidden />
                  )}
                  Reset Password
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
