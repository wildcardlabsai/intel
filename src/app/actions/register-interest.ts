"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

/**
 * Backs the "Register interest" form on the marketing site.
 *
 * Submissions are stored in newsletter_subscribers. The IP is stored only as a
 * salted hash, for abuse detection — never in the clear, and never used to
 * identify anyone.
 */

export type RegisterInterestResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  businessName: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  industry: z.string().trim().max(120).optional(),
  interests: z.array(z.string().trim().max(60)).max(10).default([]),
});

export async function registerInterest(formData: FormData): Promise<RegisterInterestResult> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    businessName: formData.get("business") || undefined,
    email: formData.get("email"),
    industry: formData.get("industry") || undefined,
    interests: formData.getAll("interests").map(String),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const { name, businessName, email, industry, interests } = parsed.data;

  try {
    const headerList = await headers();
    const forwardedFor = headerList.get("x-forwarded-for") ?? "";
    const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
    const ipHash = createHash("sha256").update(`cymru-intelligence:${ip}`).digest("hex");

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        name,
        businessName: businessName ?? null,
        industry: industry ?? null,
        interests,
        ipHash,
        unsubscribeToken: randomBytes(24).toString("base64url"),
      },
      // Re-submitting updates the details rather than erroring, and clears a
      // previous unsubscribe since this is an explicit fresh opt-in.
      update: {
        name,
        businessName: businessName ?? null,
        industry: industry ?? null,
        interests,
        unsubscribedAt: null,
      },
    });

    await prisma.consentRecord.create({
      data: { email, type: "MARKETING_EMAIL", granted: true, version: "2026-01", ipHash },
    });

    return {
      ok: true,
      message: "Thanks — we'll be in touch as Cymru Intelligence gets closer to launch.",
    };
  } catch (error) {
    logger.error("register interest failed", error);
    return {
      ok: false,
      error: "We could not record that just now. Please try again shortly.",
    };
  }
}
