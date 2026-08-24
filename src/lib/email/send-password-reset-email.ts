import "server-only";

/**
 * No email provider (SMTP, Resend, SendGrid, etc.) is configured in this
 * project yet, and none of its dependencies can send mail — adding one
 * requires real provider credentials only the deployer has. Until then, the
 * reset link is written to the server log so the flow is fully functional
 * end-to-end in development. Swap the body of this function for a real
 * provider call in production; nothing else in the reset flow needs to change.
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  console.log(
    `[password-reset] No email provider configured — reset link for ${email}:\n  ${resetUrl}\n` +
      `  (Configure a real email provider in lib/email/send-password-reset-email.ts for production use.)`
  );
}
