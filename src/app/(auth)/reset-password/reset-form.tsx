"use client";

import { requestPasswordResetAction } from "@/app/(auth)/actions";
import { FormMessages, SubmitButton, useAuthForm } from "@/components/auth/auth-form";
import { Input, Label } from "@/components/ui/primitives";

export function ResetPasswordForm() {
  const [state, formAction] = useAuthForm(requestPasswordResetAction);

  if (state.success) return <FormMessages state={state} />;

  return (
    <form action={formAction} className="space-y-4">
      <FormMessages state={state} />
      <div>
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <SubmitButton>Send reset link</SubmitButton>
    </form>
  );
}
