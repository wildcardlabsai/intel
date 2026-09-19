"use client";

import { ArrowRight } from "lucide-react";
import { useRegisterInterest } from "@/context/RegisterInterestContext";

type Variant = "cream" | "outline-dark" | "outline-light" | "text-dark" | "text-light";

const variantClasses: Record<Variant, string> = {
  cream:
    "bg-[#eef0e4] text-ink-900 hover:bg-white",
  "outline-dark":
    "bg-green-900 text-cream hover:bg-green-800 border border-green-900",
  "outline-light":
    "bg-transparent text-cream border border-cream/40 hover:bg-cream/10",
  "text-dark": "text-ink-900 hover:text-green-800",
  "text-light": "text-cream hover:text-white",
};

const isTextVariant = (v: Variant) => v === "text-dark" || v === "text-light";

export default function RegisterButton({
  variant = "cream",
  className = "",
  label = "Register interest",
  showArrow = true,
}: {
  variant?: Variant;
  className?: string;
  label?: string;
  showArrow?: boolean;
}) {
  const { openModal } = useRegisterInterest();

  const base = isTextVariant(variant)
    ? "inline-flex items-center gap-2 font-semibold transition-colors duration-200"
    : "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold tracking-wide transition-all duration-200 hover:gap-3";

  return (
    <button
      type="button"
      onClick={openModal}
      className={`${base} ${variantClasses[variant]} ${className}`}
    >
      {label}
      {showArrow && <ArrowRight className="h-4 w-4" strokeWidth={2.25} />}
    </button>
  );
}
