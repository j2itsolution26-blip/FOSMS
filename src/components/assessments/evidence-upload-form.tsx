"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const TYPE_OPTIONS = [
  { value: "PRACTICAL_DEMONSTRATION", label: "Practical Demonstration" },
  { value: "OBSERVATION", label: "Observation" },
  { value: "WRITTEN_WORK", label: "Written Work" },
  { value: "SIMULATION", label: "Simulation" },
  { value: "PERFORMANCE_EVIDENCE", label: "Performance Evidence" },
  { value: "DOCUMENT", label: "Supporting Document" },
];

export function EvidenceUploadForm({ assessmentId, onDone }: { assessmentId: string; onDone: () => void }) {
  const [type, setType] = useState("OBSERVATION");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!description.trim() && !file) {
      toast.error("Add a description or attach a file.");
      return;
    }
    setBusy(true);
    const formData = new FormData();
    formData.append("type", type);
    formData.append("description", description);
    if (file) formData.append("file", file);

    const res = await fetch(`/api/assessments/${assessmentId}/evidence`, { method: "POST", body: formData });
    const body = await res.json();
    setBusy(false);

    if (!body.success) {
      toast.error(body.message || "Failed to record evidence.");
      return;
    }
    toast.success("Evidence recorded.");
    setDescription("");
    setFile(null);
    onDone();
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Evidence Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Attach File (optional)</Label>
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground hover:bg-slate-50">
            <UploadCloud className="h-4 w-4" />
            <span className="truncate">{file ? file.name : "Choose file…"}</span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was observed or demonstrated…" />
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={busy}>
        {busy ? "Saving…" : "Add Evidence"}
      </Button>
    </div>
  );
}
