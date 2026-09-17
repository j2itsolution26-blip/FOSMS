"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

/** One password field with a show/hide toggle — same InputGroup composition
 * the sign-in and reset-password screens already use, so this page reads as
 * part of the same system rather than a bolted-on form. */
export function PasswordField({
  label,
  placeholder,
  autoComplete,
  value,
  onChange,
  onBlur,
  name,
  disabled,
  ref,
}: {
  label: string;
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (...event: unknown[]) => void;
  onBlur: () => void;
  name: string;
  disabled?: boolean;
  /** Forwarded from react-hook-form's field so a failed validation can focus
   * the offending input (React 19 passes `ref` as an ordinary prop). */
  ref?: React.Ref<HTMLInputElement>;
}) {
  const [show, setShow] = useState(false);

  return (
    <InputGroup className="h-10 rounded-lg">
      <InputGroupAddon>
        <Lock aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        ref={ref}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          size="icon-sm"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          onClick={() => setShow((v) => !v)}
        >
          {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

/** Label/value line used for read-only account information. */
export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="shrink-0 text-[13px] font-medium text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium break-words text-slate-900">{children}</span>
    </div>
  );
}

export const PASSWORD_RULE = "At least 10 characters, including an uppercase letter, a lowercase letter, and a number.";
