"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { getEnv, isConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

/**
 * Authentication server actions.
 *
 * All credential handling is delegated to Supabase Auth. These actions
 * validate input, call Supabase, and translate its errors into messages that
 * are safe to show — in particular, sign-in failures are deliberately vague so
 * the form cannot be used to enumerate registered email addresses.
 */

export type AuthState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

const NOT_CONFIGURED: AuthState = {
  error:
    "Authentication is not configured on this deployment. Set NEXT_PUBLIC_SUPABASE_URL, " +
    "NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to enable accounts.",
};

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");
const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Password is too long");

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: emailSchema,
  password: passwordSchema,
  organisationName: z.string().trim().max(200).optional(),
  marketingConsent: z.boolean().default(false),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !result[key]) result[key] = issue.message;
  }
  return result;
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isConfigured("supabase")) return NOT_CONFIGURED;

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    organisationName: formData.get("organisationName") || undefined,
    marketingConsent: formData.get("marketingConsent") === "on",
  });

  if (!parsed.success) {
    return { error: "Please check the form below.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { name, email, password, organisationName, marketingConsent } = parsed.data;
  const env = getEnv();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, organisation_name: organisationName ?? null },
      emailRedirectTo: `${env.APP_URL}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    logger.warn("registration failed", { message: error.message });
    // Supabase returns a distinct message for an existing address; keep it
    // generic so the form cannot confirm who has an account.
    return {
      error:
        error.message.toLowerCase().includes("already registered")
          ? "If that address can be registered, we have sent a confirmation email."
          : error.message,
    };
  }

  if (data.user) {
    await prisma.consentRecord.create({
      data: {
        email,
        type: "TERMS",
        granted: true,
        version: "2026-01",
      },
    });

    if (marketingConsent) {
      await prisma.consentRecord.create({
        data: { email, type: "MARKETING_EMAIL", granted: true, version: "2026-01" },
      });
    }
  }

  return {
    success:
      "Check your email to confirm your address. The link signs you in and opens your dashboard.",
  };
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isConfigured("supabase")) return NOT_CONFIGURED;

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Please check the form below.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    logger.info("sign-in rejected", { reason: error.message });
    return { error: "That email and password combination was not recognised." };
  }

  const next = formData.get("next");
  const target = typeof next === "string" && next.startsWith("/") ? next : "/dashboard";

  revalidatePath("/", "layout");
  redirect(target);
}

export async function signOutAction(): Promise<void> {
  if (isConfigured("supabase")) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!isConfigured("supabase")) return NOT_CONFIGURED;

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const env = getEnv();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${env.APP_URL}/auth/callback?next=/account/password`,
  });

  if (error) logger.warn("password reset request failed", { message: error.message });

  // Always the same response, so the form cannot be used to discover which
  // addresses are registered.
  return {
    success: "If that address has an account, a password reset link is on its way.",
  };
}

const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function updatePasswordAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!isConfigured("supabase")) return NOT_CONFIGURED;

  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: "Please check the form below.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) return { error: error.message };

  return { success: "Your password has been updated." };
}

export async function signInWithGoogleAction(): Promise<AuthState | void> {
  if (!isConfigured("supabase")) return NOT_CONFIGURED;

  const env = getEnv();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${env.APP_URL}/auth/callback?next=/dashboard` },
  });

  if (error || !data.url) {
    return {
      error:
        "Google sign-in is not enabled for this project. Enable the Google provider in " +
        "Supabase → Authentication → Providers.",
    };
  }

  redirect(data.url);
}
