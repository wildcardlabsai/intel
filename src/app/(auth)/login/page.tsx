import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/app/(auth)/login/login-form";
import { NotConfigured } from "@/components/source-attribution";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { getIntegrationStatuses } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in | Cymru Intelligence",
  description: "Sign in to the Cymru Intelligence platform.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const supabase = getIntegrationStatuses().find((s) => s.key === "supabase");

  if (!supabase?.configured) {
    return (
      <NotConfigured
        title="Authentication is not configured"
        integration="sign-in"
        missingEnvVars={supabase?.missingEnvVars ?? []}
        impact={supabase?.impact ?? "Accounts are unavailable on this deployment."}
        docsUrl={supabase?.docsUrl}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>
          Access Welsh company, planning, procurement and funding intelligence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={params.next} />
        <p className="mt-6 text-center text-sm text-muted">
          No account yet?{" "}
          <Link href="/register" className="font-semibold text-accent-green hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
