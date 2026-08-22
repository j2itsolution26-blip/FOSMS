"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

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

export function DocumentUploadDialog({
  open,
  onOpenChange,
  traineeId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traineeId: string;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleUpload() {
    if (!file || !label.trim()) return;
    setBusy(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("label", label.trim());
    const res = await fetch(`/api/trainees/${traineeId}/documents`, { method: "POST", body: formData });
    const body = await res.json();
    setBusy(false);

    if (!body.success) {
      toast.error(body.message || "Upload failed.");
      return;
    }
    toast.success("Document uploaded.");
    setFile(null);
    setLabel("");
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>JPG, PNG, WEBP, PDF, DOC/DOCX, XLS/XLSX, or TXT — up to 10MB.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-label">Label</Label>
            <Input id="doc-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ID document, certificate, etc." />
          </div>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-slate-50">
            <UploadCloud className="h-6 w-6" aria-hidden />
            {file ? file.name : "Click to select a file"}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleUpload} disabled={!file || !label.trim() || busy}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
