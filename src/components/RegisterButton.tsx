"use client";

import { useRegisterInterest } from "@/context/RegisterInterestContext";

type Variant = "cream" | "dark";

const variantClasses: Record<Variant, string> = {
  cream:
    "bg-cream-button text-ink-900 hover:bg-cream-hover shadow-md",
  dark: "bg-green-900 text-white hover:bg-green-800 border border-white/20 shadow-sm",
};

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

  return (
    <button
      type="button"
      onClick={openModal}
      className={`group inline-flex items-center justify-center gap-3 rounded-md px-6 py-3.5 text-base font-semibold transition-all duration-200 ${variantClasses[variant]} ${className}`}
    >
      <span>{label}</span>
      {showArrow && (
        <svg
          className="h-4 w-4 transform transition-transform group-hover:translate-x-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      )}
    </button>
  );
}
