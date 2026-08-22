import { apiSuccess, apiUnauthorized } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiUnauthorized();

  return apiSuccess({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles,
    permissions: Array.from(user.permissions),
  });
}
