"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AuthState } from "@/app/(auth)/actions";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Please wait…" : children}
    </Button>
  );
}

export function FormMessages({ state }: { state: AuthState }) {
  if (state.success) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{state.success}</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{state.error}</p>
      </div>
    );
  }

  return null;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-700">{message}</p>;
}

export function useAuthForm(
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>
) {
  return useActionState<AuthState, FormData>(action, {});
}
