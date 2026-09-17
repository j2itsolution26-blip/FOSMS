"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Check, ConciergeBell, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { specialRequestItemSchema, type SpecialRequestItemInput } from "@/validators/special-request.schema";

// ---------------------------------------------------------------------------
// Draft entries (not yet saved)
// ---------------------------------------------------------------------------

export type SpecialRequestDraft = {
  key: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
  isChargeable: boolean;
  notes: string;
};

type DraftField = "itemName" | "quantity" | "unitPrice" | "notes";
type DraftErrors = Record<string, Partial<Record<DraftField, string>>>;

function currency(n: number) {
  return `₱${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function newDraft(): SpecialRequestDraft {
  return { key: nanoid(), itemName: "", quantity: "1", unitPrice: "", isChargeable: true, notes: "" };
}

function draftTotal(d: SpecialRequestDraft) {
  if (!d.isChargeable) return 0;
  const qty = Number(d.quantity);
  const price = Number(d.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price <= 0) return 0;
  return Math.round(qty * price * 100) / 100;
}

/**
 * Validates drafts with the same schema the API enforces and builds the
 * request payload. `requestKey` is the draft's stable key, so resubmitting
 * the same entries (a retry, a double click) never bills them twice.
 */
export function validateSpecialRequestDrafts(drafts: SpecialRequestDraft[]): {
  valid: boolean;
  errors: DraftErrors;
  items: SpecialRequestItemInput[];
} {
  const errors: DraftErrors = {};
  const items: SpecialRequestItemInput[] = [];
  for (const d of drafts) {
    const parsed = specialRequestItemSchema.safeParse({
      requestKey: d.key,
      itemName: d.itemName,
      quantity: d.quantity.trim() === "" ? undefined : d.quantity,
      unitPrice: d.isChargeable ? (d.unitPrice.trim() === "" ? undefined : d.unitPrice) : 0,
      isChargeable: d.isChargeable,
      notes: d.notes,
    });
    if (parsed.success) {
      items.push(parsed.data);
    } else {
      const fieldErrors: Partial<Record<DraftField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as DraftField;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      errors[d.key] = fieldErrors;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors, items };
}

function ConfirmRemoveDialog({
  target,
  busy,
  onCancel,
  onConfirm,
}: {
  target: { itemName: string; total: number } | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove chargeable request?</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                <span className="font-medium text-slate-900">{target.itemName || "This request"}</span>
                {target.total > 0 ? <> ({currency(target.total)} before VAT)</> : null} will be removed and will no
                longer be charged to the guest.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Keep
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChargeToggle({
  value,
  onChange,
  idPrefix,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  idPrefix: string;
}) {
  return (
    <div role="radiogroup" aria-label="Charge type" className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
      {[
        { v: true, label: "Chargeable" },
        { v: false, label: "No Charge" },
      ].map((opt) => (
        <button
          key={opt.label}
          id={`${idPrefix}-${opt.v ? "chargeable" : "free"}`}
          type="button"
          role="radio"
          aria-checked={value === opt.v}
          onClick={() => onChange(opt.v)}
          className={cn(
            "rounded px-2.5 py-1 font-medium transition-colors",
            value === opt.v
              ? opt.v
                ? "bg-[#0b1c3f] text-white"
                : "bg-slate-700 text-white"
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DraftRow({
  draft,
  index,
  errors,
  onChange,
  onRemove,
}: {
  draft: SpecialRequestDraft;
  index: number;
  errors?: Partial<Record<DraftField, string>>;
  onChange: (next: SpecialRequestDraft) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const total = draftTotal(draft);
  const set = <K extends keyof SpecialRequestDraft>(k: K, v: SpecialRequestDraft[K]) => onChange({ ...draft, [k]: v });
  const inputClass = "h-9 rounded-md border-slate-200 bg-white text-sm";
  const errorClass = "border-red-400 focus-visible:ring-red-400";

  return (
    <li className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Request {index + 1}</span>
        <div className="flex items-center gap-1.5">
          <ChargeToggle value={draft.isChargeable} onChange={(v) => set("isChargeable", v)} idPrefix={id} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:bg-red-50 hover:text-red-600"
            onClick={onRemove}
            aria-label={`Remove request ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
        <div className="col-span-2 sm:col-span-5">
          <Label htmlFor={`${id}-name`} className="mb-1 text-xs font-medium text-slate-700">
            Request / Item Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`${id}-name`}
            value={draft.itemName}
            onChange={(e) => set("itemName", e.target.value)}
            placeholder="e.g. Wine, Extra towels"
            maxLength={150}
            aria-invalid={!!errors?.itemName}
            className={cn(inputClass, errors?.itemName && errorClass)}
          />
          {errors?.itemName ? <p className="mt-1 text-xs text-red-600">{errors.itemName}</p> : null}
        </div>
        <div className="col-span-1 sm:col-span-2">
          <Label htmlFor={`${id}-qty`} className="mb-1 text-xs font-medium text-slate-700">
            Quantity <span className="text-red-500">*</span>
          </Label>
          <Input
            id={`${id}-qty`}
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            step={1}
            value={draft.quantity}
            onChange={(e) => set("quantity", e.target.value)}
            aria-invalid={!!errors?.quantity}
            className={cn(inputClass, errors?.quantity && errorClass)}
          />
          {errors?.quantity ? <p className="mt-1 text-xs text-red-600">{errors.quantity}</p> : null}
        </div>
        {draft.isChargeable ? (
          <>
            <div className="col-span-1 sm:col-span-3">
              <Label htmlFor={`${id}-price`} className="mb-1 text-xs font-medium text-slate-700">
                Unit Price <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-slate-500">₱</span>
                <Input
                  id={`${id}-price`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={draft.unitPrice}
                  onChange={(e) => set("unitPrice", e.target.value)}
                  aria-invalid={!!errors?.unitPrice}
                  className={cn(inputClass, "pl-6", errors?.unitPrice && errorClass)}
                />
              </div>
              {errors?.unitPrice ? <p className="mt-1 text-xs text-red-600">{errors.unitPrice}</p> : null}
            </div>
            <div className="col-span-2 sm:col-span-2">
              <p className="mb-1 text-xs font-medium text-slate-700">Total</p>
              <p className="flex h-9 items-center justify-end rounded-md bg-slate-50 px-2.5 font-mono text-sm font-semibold text-[#0b1c3f]" aria-live="polite">
                {currency(total)}
              </p>
            </div>
          </>
        ) : (
          <div className="col-span-1 sm:col-span-5">
            <p className="mb-1 text-xs font-medium text-slate-700">Total</p>
            <p className="flex h-9 items-center rounded-md bg-slate-50 px-2.5 text-sm text-slate-500">No charge</p>
          </div>
        )}
        <div className="col-span-2 sm:col-span-12">
          <Label htmlFor={`${id}-notes`} className="mb-1 text-xs font-medium text-slate-700">
            Notes / Instructions <span className="font-normal text-slate-400">(optional)</span>
          </Label>
          <Input
            id={`${id}-notes`}
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="e.g. Deliver chilled to the room at 7 PM"
            maxLength={500}
            aria-invalid={!!errors?.notes}
            className={cn(inputClass, errors?.notes && errorClass)}
          />
          {errors?.notes ? <p className="mt-1 text-xs text-red-600">{errors.notes}</p> : null}
        </div>
      </div>
    </li>
  );
}

function SectionShell({
  description,
  children,
}: {
  description: string;
  children: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-slate-200 bg-slate-50/50">
      <div className="flex items-start gap-2.5 border-b border-slate-200 px-4 py-3">
        <ConciergeBell className="mt-0.5 h-4 w-4 shrink-0 text-[#0b1c3f]" aria-hidden />
        <div>
          <h3 id={headingId} className="text-xs font-bold tracking-wider text-[#0b1c3f] uppercase">
            Special Requests &amp; Additional Charges
          </h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-3 px-4 py-3">{children}</div>
    </section>
  );
}

/**
 * Unsaved entries edited inside a larger form (Guest Folio / Walk-In) — the
 * parent submits them with the rest of the folio in one atomic save.
 */
export function SpecialRequestsDraftEditor({
  value,
  onChange,
  errors,
  embedded = false,
}: {
  value: SpecialRequestDraft[];
  onChange: (next: SpecialRequestDraft[]) => void;
  errors?: DraftErrors;
  // Rendered inside SpecialRequestsPanel (no own card/heading).
  embedded?: boolean;
}) {
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const confirmDraft = value.find((d) => d.key === confirmKey) ?? null;

  const chargeable = value.filter((d) => d.isChargeable);
  const chargeableTotal = chargeable.reduce((sum, d) => sum + draftTotal(d), 0);
  const nonChargeable = value.length - chargeable.length;

  function remove(d: SpecialRequestDraft) {
    // A chargeable entry with details already typed in asks first.
    if (d.isChargeable && (d.itemName.trim() || d.unitPrice.trim())) {
      setConfirmKey(d.key);
      return;
    }
    onChange(value.filter((x) => x.key !== d.key));
  }

  const body = (
    <>
      {value.length > 0 ? (
        <ul className="space-y-2.5">
          {value.map((d, i) => (
            <DraftRow
              key={d.key}
              draft={d}
              index={i}
              errors={errors?.[d.key]}
              onChange={(next) => onChange(value.map((x) => (x.key === d.key ? next : x)))}
              onRemove={() => remove(d)}
            />
          ))}
        </ul>
      ) : !embedded ? (
        <p className="text-xs text-muted-foreground">No special requests added.</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, newDraft()])}>
          <Plus className="h-4 w-4" /> Add Special Request
        </Button>
        {value.length > 0 ? (
          <p className="text-xs text-slate-600">
            {chargeable.length > 0 ? (
              <>
                Chargeable: <span className="font-mono font-semibold text-[#0b1c3f]">{currency(chargeableTotal)}</span>{" "}
                <span className="text-muted-foreground">+ VAT</span>
              </>
            ) : null}
            {chargeable.length > 0 && nonChargeable > 0 ? " · " : null}
            {nonChargeable > 0 ? `${nonChargeable} no-charge request${nonChargeable === 1 ? "" : "s"}` : null}
          </p>
        ) : null}
      </div>

      <ConfirmRemoveDialog
        target={confirmDraft ? { itemName: confirmDraft.itemName, total: draftTotal(confirmDraft) } : null}
        onCancel={() => setConfirmKey(null)}
        onConfirm={() => {
          onChange(value.filter((x) => x.key !== confirmKey));
          setConfirmKey(null);
        }}
      />
    </>
  );

  if (embedded) return body;
  return (
    <SectionShell description="Chargeable requests are billed to the room and settled at check-out. No-charge requests are kept for staff follow-up only.">
      {body}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Single-request modal (compact Check-Out section)
// ---------------------------------------------------------------------------

type AddFormState = { itemName: string; quantity: string; unitPrice: string; requestedFor: string; notes: string };
const EMPTY_ADD_FORM: AddFormState = { itemName: "", quantity: "1", unitPrice: "", requestedFor: "", notes: "" };
// Room left in the 500-character notes column for the "Requested for" prefix.
const ADD_NOTES_MAX = 440;

/**
 * There is no delivery-time column, so an optional requested time is kept
 * at the front of the request's notes ("Requested for: …"), where every list,
 * folio and receipt that shows notes already displays it.
 */
function composeRequestNotes(requestedFor: string, notes: string) {
  const when = requestedFor
    ? new Date(requestedFor).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "";
  const parts = [when ? `Requested for: ${when}` : "", notes.trim()].filter(Boolean);
  return parts.join(" — ");
}

function AddSpecialRequestDialog({
  open,
  onOpenChange,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSubmit: (item: SpecialRequestItemInput) => void;
}) {
  const id = useId();
  const [form, setForm] = useState<AddFormState>(EMPTY_ADD_FORM);
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  // One key per opening: a double click or retried save of this entry is
  // returned by the server instead of being billed twice.
  const [requestKey, setRequestKey] = useState(() => nanoid());

  useEffect(() => {
    if (open) {
      setForm(EMPTY_ADD_FORM);
      setErrors({});
      setRequestKey(nanoid());
    }
  }, [open]);

  const set = <K extends keyof AddFormState>(k: K, v: AddFormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const qty = Number(form.quantity);
  const price = Number(form.unitPrice);
  const total =
    Number.isFinite(qty) && Number.isFinite(price) && qty > 0 && price > 0 ? Math.round(qty * price * 100) / 100 : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Partial<Record<DraftField, string>> = {};
    if (form.unitPrice.trim() === "") nextErrors.unitPrice = "Enter a unit price (₱0.00 for a no-charge request).";
    // ₱0.00 records a no-charge request for staff follow-up only.
    const isChargeable = price > 0;
    const parsed = specialRequestItemSchema.safeParse({
      requestKey,
      itemName: form.itemName,
      quantity: form.quantity.trim() === "" ? undefined : form.quantity,
      unitPrice: form.unitPrice.trim() === "" ? undefined : isChargeable ? form.unitPrice : 0,
      isChargeable,
      notes: composeRequestNotes(form.requestedFor, form.notes),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as DraftField;
        if (!nextErrors[field]) nextErrors[field] = issue.message;
      }
    }
    if (form.unitPrice.trim() !== "" && price < 0) nextErrors.unitPrice = "Unit price cannot be negative.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !parsed.success) return;
    onSubmit(parsed.data);
  }

  const inputClass = "h-9 rounded-md border-slate-200 bg-white text-sm";
  const errorClass = "border-red-400 focus-visible:ring-red-400";

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0b1c3f]">
            <ConciergeBell className="h-4.5 w-4.5" aria-hidden /> Add Special Request
          </DialogTitle>
          <DialogDescription>A chargeable request is added to the guest&apos;s balance immediately.</DialogDescription>
        </DialogHeader>

        <form id={`${id}-form`} onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate>
          <div className="col-span-2">
            <Label htmlFor={`${id}-name`} className="mb-1 text-xs font-medium text-slate-700">
              Request / Item Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`${id}-name`}
              autoFocus
              value={form.itemName}
              onChange={(e) => set("itemName", e.target.value)}
              placeholder="e.g. Wine"
              maxLength={150}
              aria-invalid={!!errors.itemName}
              className={cn(inputClass, errors.itemName && errorClass)}
            />
            {errors.itemName ? <p className="mt-1 text-xs text-red-600">{errors.itemName}</p> : null}
          </div>
          <div>
            <Label htmlFor={`${id}-qty`} className="mb-1 text-xs font-medium text-slate-700">
              Quantity <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`${id}-qty`}
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              step={1}
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              aria-invalid={!!errors.quantity}
              className={cn(inputClass, errors.quantity && errorClass)}
            />
            {errors.quantity ? <p className="mt-1 text-xs text-red-600">{errors.quantity}</p> : null}
          </div>
          <div>
            <Label htmlFor={`${id}-price`} className="mb-1 text-xs font-medium text-slate-700">
              Unit Price <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-slate-500">₱</span>
              <Input
                id={`${id}-price`}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={form.unitPrice}
                onChange={(e) => set("unitPrice", e.target.value)}
                aria-invalid={!!errors.unitPrice}
                className={cn(inputClass, "pl-6", errors.unitPrice && errorClass)}
              />
            </div>
            {errors.unitPrice ? <p className="mt-1 text-xs text-red-600">{errors.unitPrice}</p> : null}
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm" aria-live="polite">
            <span className="text-slate-600">
              Total
              {total > 0 ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({qty} × {currency(price)})
                </span>
              ) : form.unitPrice.trim() !== "" && price === 0 ? (
                <span className="ml-1 text-xs text-muted-foreground">(no charge)</span>
              ) : null}
            </span>
            <span className="font-mono font-semibold text-[#0b1c3f]">{currency(total)}</span>
          </div>
          <div className="col-span-2">
            <Label htmlFor={`${id}-when`} className="mb-1 text-xs font-medium text-slate-700">
              Delivery / Request Time <span className="font-normal text-slate-400">(optional)</span>
            </Label>
            <Input
              id={`${id}-when`}
              type="datetime-local"
              value={form.requestedFor}
              onChange={(e) => set("requestedFor", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor={`${id}-notes`} className="mb-1 text-xs font-medium text-slate-700">
              Notes <span className="font-normal text-slate-400">(optional)</span>
            </Label>
            <Input
              id={`${id}-notes`}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="e.g. Deliver chilled"
              maxLength={ADD_NOTES_MAX}
              aria-invalid={!!errors.notes}
              className={cn(inputClass, errors.notes && errorClass)}
            />
            {errors.notes ? <p className="mt-1 text-xs text-red-600">{errors.notes}</p> : null}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Saved entries on an existing stay (Check-In / Check-Out)
// ---------------------------------------------------------------------------

// The request's own fulfilment state — only PENDING -> COMPLETED or
// PENDING -> CANCELLED (enforced server-side).
type SavedRequestStatus = "PENDING" | "COMPLETED" | "CANCELLED";
// The charge's payment state, derived from the ledger.
type SavedPaymentStatus = "NO_CHARGE" | "PENDING" | "PARTIALLY_PAID" | "PAID";

type SavedRequest = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isChargeable: boolean;
  notes: string | null;
  createdAt: string;
  addedBy: string | null;
  status: SavedRequestStatus;
  paymentStatus: SavedPaymentStatus;
  charge: { id: string; transactionNo: string; amount: number; vatAmount: number; paidAmount: number } | null;
  removable: boolean;
};

export type SpecialRequestStay = {
  guestName: string;
  roomNumber: string | null;
  reservationNo: string;
  arrivalDate: string;
  checkedInAt: string | null;
  departureDate: string;
};

type SavedList = { reservationStatus: string; canModify: boolean; stay: SpecialRequestStay; items: SavedRequest[] };

const SAVED_STATUS_META: Record<SavedRequestStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700" },
  COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-700" },
  CANCELLED: { label: "Cancelled", className: "bg-red-50 text-red-700" },
};

// Shown next to the status only when it adds something (a payment, or a
// request that was never chargeable).
function paymentChip(r: { paymentStatus: SavedPaymentStatus; isChargeable: boolean; status: SavedRequestStatus }) {
  if (r.paymentStatus === "PAID") return { label: "Paid", className: "bg-emerald-50 text-emerald-700" };
  if (r.paymentStatus === "PARTIALLY_PAID") return { label: "Partially Paid", className: "bg-blue-50 text-blue-700" };
  if (!r.isChargeable && r.status !== "CANCELLED") return { label: "No Charge", className: "bg-slate-100 text-slate-600" };
  return null;
}

function sameRequest(draft: SpecialRequestItemInput, saved: SavedRequest) {
  return (
    draft.itemName.trim().toLowerCase() === saved.itemName.trim().toLowerCase() &&
    draft.quantity === saved.quantity &&
    draft.isChargeable === saved.isChargeable &&
    (!draft.isChargeable || Math.abs(draft.unitPrice - saved.unitPrice) < 0.005)
  );
}

/**
 * A stay's saved Special Requests plus an inline form to add more. Every
 * change is saved immediately and `onChanged` fires so the parent can
 * re-pull its balance/folio from the server.
 */
export function SpecialRequestsPanel({
  reservationId,
  onChanged,
  onLoaded,
  readOnly = false,
  bare = false,
  compact = false,
  actions,
  refreshKey,
}: {
  reservationId: string;
  onChanged?: () => void;
  // Hands the stay's header details to a host (the Special Requests modal).
  onLoaded?: (stay: SpecialRequestStay) => void;
  // Viewers without manage permission see the list only.
  readOnly?: boolean;
  // Rendered inside a host that already has its own title (no section card).
  bare?: boolean;
  // Check-Out: a scrollable list and a single-request modal instead of the
  // inline multi-entry editor, so the host dialog stays short.
  compact?: boolean;
  // Extra header buttons (compact only), e.g. Check-Out's damage charge.
  actions?: React.ReactNode;
  // Changing this re-pulls the list (e.g. after a payment on the host).
  refreshKey?: string | number;
}) {
  const [list, setList] = useState<SavedList | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<SpecialRequestDraft[]>([]);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<SavedRequest | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<SavedRequest | null>(null);
  // The request whose status change is in flight — one at a time.
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  // Entries that match a request already saved on this stay — confirmed
  // before saving so the same request isn't billed twice by accident.
  const [duplicates, setDuplicates] = useState<string[] | null>(null);
  const [pendingItems, setPendingItems] = useState<SpecialRequestItemInput[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<SavedList>(`/api/front-office/special-requests/${reservationId}`);
    if (res.success) {
      setList(res.data);
      onLoadedRef.current?.(res.data.stay);
    } else {
      toast.error(res.message);
    }
    setLoading(false);
    // refreshKey only exists to trigger a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId, refreshKey]);

  useEffect(() => {
    setDrafts([]);
    setErrors({});
    load();
  }, [load]);

  function save() {
    const { valid, errors: nextErrors, items } = validateSpecialRequestDrafts(drafts);
    setErrors(nextErrors);
    if (!valid) {
      toast.error("Complete the highlighted special request fields.");
      return;
    }
    saveItems(items);
  }

  // Shared by the inline editor and the single-request modal.
  async function saveItems(items: SpecialRequestItemInput[], confirmedDuplicates = false) {
    if (!confirmedDuplicates) {
      const matches = items.filter((i) =>
        (list?.items ?? []).some((saved) => saved.status !== "CANCELLED" && sameRequest(i, saved))
      );
      if (matches.length > 0) {
        setPendingItems(items);
        setDuplicates(matches.map((m) => m.itemName));
        return;
      }
    }
    setDuplicates(null);
    setPendingItems(null);
    setSaving(true);
    const res = await apiFetch<SavedList>(`/api/front-office/special-requests/${reservationId}`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.message);
      return;
    }
    setList(res.data);
    setDrafts([]);
    setErrors({});
    setAddOpen(false);
    const charged = items.filter((i) => i.isChargeable).length;
    toast.success(
      charged > 0 ? "Special requests saved and charges added to the guest folio." : "Special requests saved."
    );
    onChanged?.();
  }

  async function removeSaved(item: SavedRequest) {
    setRemoving(true);
    const res = await apiFetch<SavedList>(`/api/front-office/special-requests/item/${item.id}`, { method: "DELETE" });
    setRemoving(false);
    setConfirm(null);
    if (!res.success) {
      toast.error(res.message);
      return;
    }
    setList(res.data);
    toast.success(`${item.itemName} removed.`);
    onChanged?.();
  }

  async function changeStatus(item: SavedRequest, status: "COMPLETED" | "CANCELLED") {
    if (statusBusyId) return;
    setStatusBusyId(item.id);
    const res = await apiFetch<SavedList>(`/api/front-office/special-requests/item/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setStatusBusyId(null);
    setConfirmCancel(null);
    if (!res.success) {
      toast.error(res.message);
      // Someone else may have changed it — show the current state.
      load();
      return;
    }
    setList(res.data);
    toast.success(status === "COMPLETED" ? `${item.itemName} marked as completed.` : `${item.itemName} cancelled.`);
    onChanged?.();
  }

  const items = list?.items ?? [];
  const editable = !readOnly && (list?.canModify ?? false);

  const content = (
    <>
      {loading && !list ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading special requests…
        </p>
      ) : items.length === 0 ? (
        drafts.length === 0 ? <p className="text-xs text-muted-foreground">No special requests on this stay.</p> : null
      ) : (
        <ul
          className={cn(
            "divide-y divide-slate-200 rounded-md border border-slate-200 bg-white",
            // Only the list scrolls, so the host dialog stays usable.
            compact ? "max-h-60 overflow-y-auto overscroll-contain" : "overflow-hidden"
          )}
        >
          {items.map((r) => {
            const statusMeta = SAVED_STATUS_META[r.status];
            const chip = paymentChip(r);
            const cancelled = r.status === "CANCELLED";
            const pendingActions = editable && r.status === "PENDING";
            const busy = statusBusyId === r.id;
            return (
              <li key={r.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
                      <span className="break-words">{r.itemName}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                          statusMeta.className
                        )}
                      >
                        {statusMeta.label}
                      </span>
                      {chip ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                            chip.className
                          )}
                        >
                          {chip.label}
                        </span>
                      ) : null}
                    </p>
                    {r.notes ? <p className="mt-0.5 text-xs break-words text-slate-600">{r.notes}</p> : null}
                    <p className="mt-0.5 text-xs text-slate-600">
                      Qty {r.quantity}
                      {r.isChargeable ? <> · Unit Price {currency(r.unitPrice)}</> : null}
                      {r.charge ? <span className="text-muted-foreground"> · {r.charge.transactionNo}</span> : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Added by {r.addedBy ?? "—"} ·{" "}
                      <time dateTime={r.createdAt}>
                        {new Date(r.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                      </time>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-right">
                      <span className="block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Total</span>
                      {cancelled ? (
                        <span className="font-mono text-sm font-semibold text-slate-500">{currency(0)} charge</span>
                      ) : (
                        <span className="font-mono text-sm font-semibold text-slate-900">{currency(r.lineTotal)}</span>
                      )}
                    </span>
                    {/* Cancelled requests stay as history — no removal. */}
                    {editable && !cancelled && !compact ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        disabled={!r.removable}
                        title={
                          r.removable
                            ? `Remove ${r.itemName}`
                            : "Already paid — issue a refund in Cashiering instead"
                        }
                        aria-label={`Remove ${r.itemName}`}
                        onClick={() => (r.isChargeable ? setConfirm(r) : removeSaved(r))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                {pendingActions ? (
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 gap-1 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
                      disabled={!!statusBusyId}
                      onClick={() => changeStatus(r, "COMPLETED")}
                    >
                      {busy && !confirmCancel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Mark as Completed
                    </Button>
                    {/* Hidden once the charge has any payment — that needs a refund instead. */}
                    {r.removable ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-red-200 px-2.5 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                        disabled={!!statusBusyId}
                        onClick={() => setConfirmCancel(r)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {list && !list.canModify && !readOnly ? (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
          This stay&apos;s folio is closed — special requests can no longer be added or removed.
        </p>
      ) : null}

      {editable && !compact ? (
        <SpecialRequestsDraftEditor value={drafts} onChange={setDrafts} errors={errors} embedded />
      ) : null}

      {editable && !compact && drafts.length > 0 ? (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => {
              setDrafts([]);
              setErrors({});
            }}
          >
            Discard
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save {drafts.length === 1 ? "Request" : `${drafts.length} Requests`}
          </Button>
        </div>
      ) : null}

      <ConfirmRemoveDialog
        target={confirm ? { itemName: confirm.itemName, total: confirm.lineTotal } : null}
        busy={removing}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && removeSaved(confirm)}
      />

      <Dialog open={!!confirmCancel} onOpenChange={(o) => !o && !statusBusyId && setConfirmCancel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel this special request?</DialogTitle>
            <DialogDescription>
              {confirmCancel ? <span className="font-medium text-slate-900">{confirmCancel.itemName}</span> : null}
              {confirmCancel ? " — " : null}This request will not be charged to the guest.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmCancel(null)} disabled={!!statusBusyId}>
              Keep Request
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => confirmCancel && changeStatus(confirmCancel, "CANCELLED")}
              disabled={!!statusBusyId}
            >
              {statusBusyId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cancel Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {compact ? (
        <AddSpecialRequestDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          saving={saving}
          onSubmit={(item) => saveItems([item])}
        />
      ) : null}

      <Dialog open={!!duplicates} onOpenChange={(o) => !o && setDuplicates(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add this request again?</DialogTitle>
            <DialogDescription>
              {duplicates?.length === 1 ? (
                <>
                  <span className="font-medium text-slate-900">{duplicates[0]}</span> with the same quantity and price is
                  already on this stay.
                </>
              ) : (
                <>These requests are already on this stay with the same quantity and price: {duplicates?.join(", ")}.</>
              )}{" "}
              Save again only if the guest asked for it again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDuplicates(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => pendingItems && saveItems(pendingItems, true)} disabled={saving}>
              Save Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (compact) {
    const active = items.filter((r) => r.status !== "CANCELLED").length;
    return (
      <section aria-label="Special Requests and Additional Charges" className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#0b1c3f] uppercase">
              <ConciergeBell className="h-3.5 w-3.5" aria-hidden /> Special Requests &amp; Additional Charges
            </h3>
            <p className="text-xs text-muted-foreground">
              {items.length === 0
                ? "Chargeable requests are added to the balance above."
                : `${active} active request${active === 1 ? "" : "s"} · cancelled requests are not charged.`}
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          {content}
          {editable || actions ? (
            <div className="flex flex-wrap gap-2">
              {editable ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Special Request
                </Button>
              ) : null}
              {actions}
            </div>
          ) : null}
        </div>
      </section>
    );
  }
  if (bare) return <div className="space-y-3">{content}</div>;
  return (
    <SectionShell description="Chargeable requests are added to this stay's balance right away. No-charge requests are kept for staff follow-up only.">
      {content}
    </SectionShell>
  );
}
