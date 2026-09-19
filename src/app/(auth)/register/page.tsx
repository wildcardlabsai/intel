import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "@/app/(auth)/register/register-form";
import { NotConfigured } from "@/components/source-attribution";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { getIntegrationStatuses } from "@/lib/env";

export const metadata: Metadata = {
  title: "Create an account | Cymru Intelligence",
  description: "Create a Cymru Intelligence account.",
};

export default function RegisterPage() {
  const supabase = getIntegrationStatuses().find((s) => s.key === "supabase");

  if (!supabase?.configured) {
    return (
      <NotConfigured
        title="Registration is not configured"
        integration="account creation"
        missingEnvVars={supabase?.missingEnvVars ?? []}
        impact={supabase?.impact ?? "Accounts are unavailable on this deployment."}
        docsUrl={supabase?.docsUrl}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Start on the Free plan. No card required — upgrade whenever you need more.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent-green hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
