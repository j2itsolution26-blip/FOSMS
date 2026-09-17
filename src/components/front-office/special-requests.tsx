"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { ConciergeBell, Loader2, Plus, Trash2 } from "lucide-react";

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
// Saved entries on an existing stay (Check-In / Check-Out)
// ---------------------------------------------------------------------------

type SavedRequestStatus = "NO_CHARGE" | "PENDING" | "PARTIALLY_PAID" | "PAID";

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
  PARTIALLY_PAID: { label: "Partially Paid", className: "bg-blue-50 text-blue-700" },
  PAID: { label: "Paid", className: "bg-emerald-50 text-emerald-700" },
  NO_CHARGE: { label: "No Charge", className: "bg-slate-100 text-slate-600" },
};

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
}: {
  reservationId: string;
  onChanged?: () => void;
  // Hands the stay's header details to a host (the Special Requests modal).
  onLoaded?: (stay: SpecialRequestStay) => void;
  // Viewers without manage permission see the list only.
  readOnly?: boolean;
  // Rendered inside a host that already has its own title (no section card).
  bare?: boolean;
}) {
  const [list, setList] = useState<SavedList | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<SpecialRequestDraft[]>([]);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<SavedRequest | null>(null);
  const [removing, setRemoving] = useState(false);
  // Entries that match a request already saved on this stay — confirmed
  // before saving so the same request isn't billed twice by accident.
  const [duplicates, setDuplicates] = useState<string[] | null>(null);
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
  }, [reservationId]);

  useEffect(() => {
    setDrafts([]);
    setErrors({});
    load();
  }, [load]);

  async function save(confirmedDuplicates = false) {
    const { valid, errors: nextErrors, items } = validateSpecialRequestDrafts(drafts);
    setErrors(nextErrors);
    if (!valid) {
      toast.error("Complete the highlighted special request fields.");
      return;
    }
    if (!confirmedDuplicates) {
      const matches = items.filter((i) => (list?.items ?? []).some((saved) => sameRequest(i, saved)));
      if (matches.length > 0) {
        setDuplicates(matches.map((m) => m.itemName));
        return;
      }
    }
    setDuplicates(null);
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
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
          {items.map((r) => {
            const statusMeta = SAVED_STATUS_META[r.status];
            return (
              <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
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
                    <span className="font-mono text-sm font-semibold text-slate-900">{currency(r.lineTotal)}</span>
                  </span>
                  {editable ? (
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

      {editable ? <SpecialRequestsDraftEditor value={drafts} onChange={setDrafts} errors={errors} embedded /> : null}

      {editable && drafts.length > 0 ? (
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
          <Button type="button" size="sm" onClick={() => save()} disabled={saving}>
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
            <Button type="button" onClick={() => save(true)} disabled={saving}>
              Save Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (bare) return <div className="space-y-3">{content}</div>;
  return (
    <SectionShell description="Chargeable requests are added to this stay's balance right away. No-charge requests are kept for staff follow-up only.">
      {content}
    </SectionShell>
  );
}
