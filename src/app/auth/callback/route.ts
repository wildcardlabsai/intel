import { NextResponse, type NextRequest } from "next/server";

import { isConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the one-time code from an email confirmation, password reset or
 * OAuth redirect for a session cookie.
 *
 * `next` is validated to be a relative path so this endpoint cannot be used as
 * an open redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (!isConfigured("supabase")) {
    return NextResponse.redirect(`${origin}/login?error=not_configured`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logger.warn("auth callback failed", { message: error.message });
    return NextResponse.redirect(`${origin}/login?error=invalid_code`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
