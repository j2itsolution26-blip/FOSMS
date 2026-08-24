"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { UploadCloud, X, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/validators/trainee-portal.schema";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt,.webp";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string) {
  return name.split(".").pop()?.toUpperCase() ?? "";
}

export function UploadEvidenceDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<DocumentCategory | "">("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setLabel("");
    setCategory("");
    setDescription("");
    setFile(null);
    setProgress(0);
    setBusy(false);
    setDragOver(false);
  }, []);

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  function handleFileSelect(f: File | null) {
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      toast.error("File exceeds the 10 MB size limit.");
      return;
    }
    setFile(f);
    if (!label.trim()) {
      setLabel(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  }

  async function handleSubmit() {
    if (!file || !label.trim() || !category) return;
    setBusy(true);
    setProgress(10);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("label", label.trim());
    formData.append("category", category);
    if (description.trim()) formData.append("description", description.trim());

    // Simulate progress while uploading
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 85));
    }, 300);

    try {
      const res = await fetch("/api/me/evidence/upload", { method: "POST", body: formData });
      clearInterval(progressInterval);
      const body = await res.json();

      if (!body.success) {
        setProgress(0);
        setBusy(false);
        toast.error(body.message || "Upload failed. Please try again.");
        return;
      }

      setProgress(100);
      toast.success("Document uploaded successfully.");
      setTimeout(() => {
        reset();
        onOpenChange(false);
        onSuccess();
      }, 400);
    } catch {
      clearInterval(progressInterval);
      setProgress(0);
      setBusy(false);
      toast.error("Upload failed. Please try again.");
    }
  }

  const canSubmit = !!file && label.trim().length > 0 && !!category && !busy;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Evidence</DialogTitle>
          <DialogDescription>Upload a document or evidence file to your training records.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Name */}
          <div className="space-y-2">
            <Label htmlFor="upload-doc-name">Document Name <span className="text-destructive">*</span></Label>
            <Input
              id="upload-doc-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Training Certificate, Activity Report…"
              maxLength={200}
              disabled={busy}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="upload-doc-category">Category <span className="text-destructive">*</span></Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as DocumentCategory)}
              disabled={busy}
            >
              <SelectTrigger id="upload-doc-category" className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="upload-doc-desc">Description <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="upload-doc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this document…"
              rows={3}
              maxLength={1000}
              disabled={busy}
            />
          </div>

          {/* File Drop Zone */}
          {!file ? (
            <label
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragOver
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-blue-400 hover:bg-slate-50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                <UploadCloud className="h-6 w-6 text-blue-500" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Drag and drop your file here</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  or <span className="text-blue-600 font-medium">Browse Files</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                PDF, JPG, PNG, DOCX — Max 10 MB
              </p>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={ACCEPTED_TYPES}
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                disabled={busy}
              />
            </label>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <FileText className="h-5 w-5 text-blue-600" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getFileExtension(file.name)} · {formatFileSize(file.size)}
                  </p>
                </div>
                {!busy && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {busy && progress > 0 && (
                <div className="mt-3 space-y-1">
                  <Progress value={progress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {progress < 100 ? "Uploading document…" : "Upload complete!"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {busy ? "Uploading…" : "Upload Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
