"use client";

import { registerAction } from "@/app/(auth)/actions";
import { FieldError, FormMessages, SubmitButton, useAuthForm } from "@/components/auth/auth-form";
import { Input, Label } from "@/components/ui/primitives";

export function RegisterForm() {
  const [state, formAction] = useAuthForm(registerAction);

  // Once the confirmation email is sent, replace the form with the message so
  // the user does not submit twice.
  if (state.success) {
    return <FormMessages state={state} />;
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormMessages state={state} />

      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required placeholder="Catrin Jones" />
        <FieldError message={state.fieldErrors?.name} />
      </div>

      <div>
        <Label htmlFor="organisationName">Business or organisation (optional)</Label>
        <Input id="organisationName" name="organisationName" type="text" autoComplete="organization" placeholder="Welsh Enterprise Ltd" />
        <FieldError message={state.fieldErrors?.organisationName} />
      </div>

      <div>
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.co.uk" />
        <FieldError message={state.fieldErrors?.email} />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="mt-1 text-xs text-muted">
          At least 10 characters.
        </p>
        <FieldError message={state.fieldErrors?.password} />
      </div>

      <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <input type="checkbox" name="marketingConsent" className="mt-0.5 rounded border-border" />
        <span>
          Email me occasional Welsh business intelligence updates. You can unsubscribe at any time.
        </span>
      </label>

      <p className="text-xs leading-relaxed text-muted">
        By creating an account you agree to our{" "}
        <a href="/terms" className="text-accent-green hover:underline">
          terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-accent-green hover:underline">
          privacy policy
        </a>
        .
      </p>

      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
