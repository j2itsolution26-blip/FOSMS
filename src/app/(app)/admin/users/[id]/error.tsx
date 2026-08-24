"use client";

import { useEffect } from "react";

import { LoadErrorState } from "@/components/shared/load-error-state";

export default function UserProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/users/[id]]", error);
  }, [error]);

  return <LoadErrorState onRetry={reset} backHref="/admin/users" />;
}
