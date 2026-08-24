"use client";

import { useEffect } from "react";

import { LoadErrorState } from "@/components/shared/load-error-state";

export default function TraineeProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[trainees/[id]]", error);
  }, [error]);

  return <LoadErrorState onRetry={reset} backHref="/trainees" />;
}
