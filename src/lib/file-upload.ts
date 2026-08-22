import "server-only";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

import { AppError } from "@/lib/errors";

/**
 * Local-disk storage for user-uploaded files (assessment evidence, trainee
 * documents). Kept outside `public/` so nothing is served without going
 * through an authenticated, permission-checked API route first. Swap this
 * module for an S3/Blob-backed implementation in production — callers only
 * depend on `saveUploadedFile` / `readStoredFile` / `deleteStoredFile`.
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Allowlist only — this is what actually blocks executables, scripts, etc.
// rather than trying to blocklist dangerous extensions one by one.
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

export type StoredFile = {
  storedName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export async function saveUploadedFile(file: File, subdir: string): Promise<StoredFile> {
  if (file.size <= 0) {
    throw new AppError("The uploaded file is empty.", "EMPTY_FILE", 400);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError("File exceeds the 10MB size limit.", "FILE_TOO_LARGE", 400);
  }
  const extension = ALLOWED_MIME_TYPES[file.type];
  if (!extension) {
    throw new AppError(
      "Unsupported file type. Allowed: JPG, PNG, WEBP, PDF, DOC/DOCX, XLS/XLSX, TXT.",
      "UNSUPPORTED_FILE_TYPE",
      400
    );
  }

  const dir = path.join(STORAGE_ROOT, subdir);
  await mkdir(dir, { recursive: true });

  // Random name, never the client-supplied filename, so there's no path-traversal
  // or overwrite risk and no possibility of an executable-looking stored name.
  const storedName = `${randomBytes(24).toString("hex")}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedName), buffer);

  return {
    storedName,
    fileName: file.name.slice(0, 200),
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export async function readStoredFile(subdir: string, storedName: string): Promise<Buffer> {
  assertSafeStoredName(storedName);
  return readFile(path.join(STORAGE_ROOT, subdir, storedName));
}

export async function deleteStoredFile(subdir: string, storedName: string): Promise<void> {
  assertSafeStoredName(storedName);
  await unlink(path.join(STORAGE_ROOT, subdir, storedName)).catch(() => {});
}

function assertSafeStoredName(storedName: string) {
  // Defense in depth: stored names are always our own randomBytes-generated
  // value, but re-validate before touching the filesystem in case a caller
  // ever passes a value through from elsewhere.
  if (!/^[a-f0-9]{48}\.[a-z0-9]{2,5}$/.test(storedName)) {
    throw new AppError("Invalid file reference.", "INVALID_FILE_REFERENCE", 400);
  }
}
