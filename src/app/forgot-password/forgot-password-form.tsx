"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, AlertCircle, CheckCircle2, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { requestPasswordResetSchema, type RequestPasswordResetInput } from "@/validators/password-reset.schema";

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: RequestPasswordResetInput) {
    setServerError(null);
    const res = await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();

    if (!res.ok || !body.success) {
      setServerError(body.message || "Something went wrong. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" aria-hidden />
        </div>
        <p className="text-sm text-[#172033]">
          If an account exists for <span className="font-medium">{form.getValues("email")}</span>, we&apos;ve sent
          password reset instructions.
        </p>
        <Link href="/login" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[#0B1F44] hover:underline">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError ? (
          <Alert variant="destructive" className="items-start py-3">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertTitle>Unable to send reset link</AlertTitle>
            <AlertDescription className="text-destructive/80">{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <InputGroup className="h-11 rounded-xl">
                  <InputGroupAddon>
                    <Mail aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="email"
                    autoComplete="username"
                    placeholder="Enter your email address"
                    className="text-base"
                    {...field}
                  />
                </InputGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-[#0B1F44] text-base font-semibold text-white hover:bg-[#0B1F44]/90 focus-visible:ring-[#0B1F44]/40"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send Reset Link"
          )}
        </Button>

        <Link href="/login" className="flex items-center justify-center gap-1 text-sm font-medium text-[#0B1F44] hover:underline">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Back to Sign In
        </Link>
      </form>
    </Form>
  );
}
