"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SubmitForm({ assessmentId, onDone }: { assessmentId: string; onDone: () => void }) {
  const [observations, setObservations] = useState("");
  const [remarks, setRemarks] = useState("");
  const [score, setScore] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    const res = await fetch(`/api/assessments/${assessmentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observations, remarks, score: score ? Number(score) : undefined }),
    });
    const body = await res.json();
    setBusy(false);

    if (!body.success) {
      toast.error(body.message);
      return;
    }
    toast.success("Assessment submitted for review.");
    onDone();
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1.5">
        <Label>Observations</Label>
        <Textarea rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="What did you observe during the assessment?" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Remarks</Label>
          <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Score (optional)</Label>
          <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={busy}>
        {busy ? "Submitting…" : "Submit Assessment"}
      </Button>
    </div>
  );
}
