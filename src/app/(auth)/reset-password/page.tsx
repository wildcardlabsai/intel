import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/app/(auth)/reset-password/reset-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Reset your password | Cymru Intelligence",
};

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          Enter the address you registered with and we will send a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="font-semibold text-accent-green hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
