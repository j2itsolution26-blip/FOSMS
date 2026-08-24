"use client";

import { useEffect } from "react";

import { LoadErrorState } from "@/components/shared/load-error-state";

export default function MyAttendanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[my-attendance]", error);
  }, [error]);

  return (
    <LoadErrorState
      title="Unable to Load Attendance"
      description="We couldn't retrieve your attendance information. Please try again."
      onRetry={reset}
      backHref="/dashboard"
      backLabel="Back to Dashboard"
    />
  );
}
