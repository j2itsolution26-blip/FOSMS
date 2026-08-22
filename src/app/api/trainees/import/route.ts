import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/api-response";
import { authorize } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/request-meta";
import { PERMISSIONS } from "@/config/permissions";
import { parseCsv } from "@/lib/csv";
import { importTrainees } from "@/services/trainee.service";

const REQUIRED_HEADERS = ["firstname", "lastname", "email", "studentnumber"];

export async function POST(req: NextRequest) {
  const auth = await authorize(PERMISSIONS.TRAINEES_CREATE);
  if (auth.error) return auth.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return apiError("A CSV file is required.", "VALIDATION_ERROR", 422);
  }
  if (file.size > 1024 * 1024) {
    return apiError("CSV file is too large (max 1MB).", "FILE_TOO_LARGE", 400);
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return apiError("The CSV file has no data rows.", "EMPTY_FILE", 422);
  }

  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    return apiError(`CSV is missing required column(s): ${missing.join(", ")}.`, "INVALID_CSV_HEADER", 422);
  }

  const idx = {
    firstName: header.indexOf("firstname"),
    lastName: header.indexOf("lastname"),
    email: header.indexOf("email"),
    studentNumber: header.indexOf("studentnumber"),
  };

  const dataRows = rows.slice(1).map((r) => ({
    firstName: r[idx.firstName] ?? "",
    lastName: r[idx.lastName] ?? "",
    email: r[idx.email] ?? "",
    studentNumber: r[idx.studentNumber] ?? "",
  }));

  const result = await importTrainees(dataRows, {
    userId: auth.user.id,
    role: auth.user.roles[0] ?? null,
    ...getRequestMeta(req),
  });

  return apiSuccess(result);
}
