import type { Metadata } from "next";
import { Suspense } from "react";

import { requireOwnTraineePage } from "@/lib/auth/trainee-self";
import { AccessDenied } from "@/components/shared/access-denied";
import { MyActivitiesList } from "@/components/trainee-portal/my-activities-list";

export const metadata: Metadata = { title: "My Activities — Front Office Servicing NC II" };

export default async function MyActivitiesPage() {
  const ctx = await requireOwnTraineePage();
  if (!ctx) return <AccessDenied />;

  return (
    <Suspense>
      <MyActivitiesList />
    </Suspense>
  );
}
