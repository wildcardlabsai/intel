"use client";

import Link from "next/link";

import { loginAction } from "@/app/(auth)/actions";
import { FieldError, FormMessages, SubmitButton, useAuthForm } from "@/components/auth/auth-form";
import { Input, Label } from "@/components/ui/primitives";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useAuthForm(loginAction);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessages state={state} />

      <input type="hidden" name="next" value={next ?? "/dashboard"} />

      <div>
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.co.uk" />
        <FieldError message={state.fieldErrors?.email} />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/reset-password" className="mb-1.5 text-xs font-semibold text-accent-green hover:underline">
            Forgotten?
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
        <FieldError message={state.fieldErrors?.password} />
      </div>

      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
