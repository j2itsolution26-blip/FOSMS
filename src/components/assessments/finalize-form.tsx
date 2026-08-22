"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

  async function handleSubmit() {
    if (!result) {
      toast.error("Select a result.");
      return;
    }
    setBusy(true);
    const endpoint = mode === "finalize" ? `/api/assessments/${assessmentId}/finalize` : `/api/assessments/${assessmentId}/correct`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, remarks }),
    });
    const body = await res.json();
    setBusy(false);

    if (!body.success) {
      toast.error(body.message);
      return;
    }
    toast.success(mode === "finalize" ? "Assessment finalized." : "Correction recorded.");
    onDone();
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label>Result</Label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setResult("COMPETENT")}
            className={cn(
              "flex-1 rounded-lg border p-3 text-sm font-medium transition-colors",
              result === "COMPETENT" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "hover:bg-slate-50"
            )}
          >
            Competent
          </button>
          <button
            type="button"
            onClick={() => setResult("NOT_YET_COMPETENT")}
            className={cn(
              "flex-1 rounded-lg border p-3 text-sm font-medium transition-colors",
              result === "NOT_YET_COMPETENT" ? "border-red-500 bg-red-50 text-red-800" : "hover:bg-slate-50"
            )}
          >
            Not Yet Competent
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Remarks</Label>
        <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Assessor remarks…" />
      </div>
      <Button onClick={handleSubmit} disabled={busy}>
        {busy ? "Saving…" : mode === "finalize" ? "Finalize Result" : "Record Correction"}
      </Button>
    </div>
  );
}
