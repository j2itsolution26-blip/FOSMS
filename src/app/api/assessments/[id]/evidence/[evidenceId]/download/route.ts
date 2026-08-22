import type { NextRequest } from "next/server";

import { authorize } from "@/lib/auth/guard";
import { apiNotFound } from "@/lib/api-response";
import { PERMISSIONS } from "@/config/permissions";
import { getEvidenceById } from "@/services/assessment.service";
import { readStoredFile } from "@/lib/file-upload";
import { NotFoundError } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string; evidenceId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await authorize(PERMISSIONS.ASSESSMENTS_VIEW);
  if (auth.error) return auth.error;

  const { id, evidenceId } = await params;

  try {
    const evidence = await getEvidenceById(id, evidenceId);
    if (!evidence.storedName || !evidence.fileName || !evidence.mimeType) {
      return apiNotFound("This evidence entry has no attached file.");
    }
    const buffer = await readStoredFile("assessment-evidence", evidence.storedName);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": evidence.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(evidence.fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return apiNotFound(err.message);
    return apiNotFound();
  }
}
