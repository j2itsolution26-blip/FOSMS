import { apiNotFound } from "@/lib/api-response";
import { authorizeOwnTrainee } from "@/lib/auth/trainee-self";
import { readStoredFile } from "@/lib/file-upload";
import { NotFoundError } from "@/lib/errors";
import { getMyEvidenceFile } from "@/services/trainee-portal.service";

type RouteContext = { params: Promise<{ kind: string; id: string }> };

const VALID_KINDS = new Set(["document", "assessment-evidence", "activity-submission"]);

export async function GET(_req: Request, { params }: RouteContext) {
  const auth = await authorizeOwnTrainee();
  if (auth.error) return auth.error;

  const { kind, id } = await params;
  if (!VALID_KINDS.has(kind)) return apiNotFound();

  try {
    const file = await getMyEvidenceFile(auth.trainee.id, kind as "document" | "assessment-evidence" | "activity-submission", id);
    const buffer = await readStoredFile(file.subdir, file.storedName);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return apiNotFound(err.message);
    return apiNotFound();
  }
}
