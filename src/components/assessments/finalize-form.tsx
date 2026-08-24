"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const RESULT_OPTIONS = [
  {
    value: "COMPETENT" as const,
    label: "Competent",
    description: "The trainee successfully met the required competency standards.",
    icon: CheckCircle2,
    selectedClass: "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500",
    iconClass: "text-emerald-600",
    dotClass: "bg-emerald-500",
  },
  {
    value: "NOT_YET_COMPETENT" as const,
    label: "Not Yet Competent",
    description: "The trainee requires further training, improvement, or reassessment.",
    icon: XCircle,
    selectedClass: "border-red-500 bg-red-50 ring-1 ring-red-500",
    iconClass: "text-red-600",
    dotClass: "bg-red-500",
  },
];

export function FinalizeForm({
  assessmentId,
  mode,
  onDone,
}: {
  assessmentId: string;
  mode: "finalize" | "correct";
  onDone: () => void;
}) {
  const [result, setResult] = useState<"COMPETENT" | "NOT_YET_COMPETENT" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    const endpoint = mode === "finalize" ? `/api/assessments/${assessmentId}/finalize` : `/api/assessments/${assessmentId}/correct`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, remarks }),
    });
    const body = await res.json();
    setBusy(false);
    setConfirmOpen(false);

    if (!body.success) {
      toast.error(body.message);
      return;
    }
    toast.success(mode === "finalize" ? "Assessment finalized." : "Correction recorded.");
    onDone();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Result</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {RESULT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = result === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setResult(opt.value)}
                aria-pressed={selected}
                className={cn(
                  "relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150",
                  selected ? opt.selectedClass : "border-border hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {selected ? (
                  <span className={cn("absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full text-white", opt.dotClass)}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                <Icon className={cn("h-6 w-6", selected ? opt.iconClass : "text-muted-foreground")} aria-hidden />
                <p className="font-semibold text-slate-900">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Assessor Remarks</Label>
        <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Assessor remarks…" />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          onClick={() => {
            if (!result) {
              toast.error("Select a result.");
              return;
            }
            setConfirmOpen(true);
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          {mode === "finalize" ? "Finalize Result" : "Record Correction"}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "finalize" ? "Finalize Assessment?" : "Confirm Correction?"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to {mode === "finalize" ? "finalize this assessment result" : "record this correction"}?
              This action may no longer be editable after submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={busy}>
              {busy ? "Saving…" : "Yes, Finalize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
