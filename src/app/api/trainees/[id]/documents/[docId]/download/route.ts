import type { NextRequest } from "next/server";

import { authorize } from "@/lib/auth/guard";
import { apiNotFound } from "@/lib/api-response";
import { PERMISSIONS } from "@/config/permissions";
import { getTraineeDocument } from "@/services/trainee.service";
import { readStoredFile } from "@/lib/file-upload";
import { NotFoundError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string; docId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.TRAINEES_VIEW);
  if (auth.error) return auth.error;

  const { id, docId } = await params;

  try {
    const document = await getTraineeDocument(id, docId);
    const buffer = await readStoredFile("trainee-documents", document.storedName);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(document.fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return apiNotFound(err.message);
    return apiNotFound();
  }
}
