"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useRegisterInterest } from "@/context/RegisterInterestContext";

const INTERESTS = [
  "Business intelligence",
  "Planning",
  "Procurement",
  "Funding",
  "Companies",
  "Economic data",
  "Other",
];

export default function RegisterInterestModal() {
  const { isOpen, closeModal } = useRegisterInterest();
  const [submitted, setSubmitted] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, closeModal]);

  useEffect(() => {
    if (!isOpen) {
      const timeout = setTimeout(() => {
        setSubmitted(false);
        setSelectedInterests([]);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        aria-label="Close"
        onClick={closeModal}
        className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-cream shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-cream px-6 py-5 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Register interest
            </p>
            <h2 className="mt-1 text-xl font-bold text-ink-900">
              Be first to know when we launch
            </h2>
          </div>
          <button
            onClick={closeModal}
            aria-label="Close"
            className="rounded-full p-2 text-muted transition-colors hover:bg-border/40 hover:text-ink-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 px-6 py-14 text-center sm:px-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-900/10">
              <CheckCircle2 className="h-7 w-7 text-green-800" strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-bold text-ink-900">
              Thanks &mdash; you&apos;re on the list
            </h3>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              We&apos;ve noted your interest. This is a pre-launch site, so no
              account has been created and nothing has been saved to a live
              system yet &mdash; we&apos;ll be in touch by email as Cymru
              Intelligence gets closer to launch.
            </p>
            <button
              onClick={closeModal}
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-green-900 px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-green-800"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6 sm:px-8">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Name" htmlFor="name">
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Catrin Jones"
                  className={inputClasses}
                />
              </Field>
              <Field label="Business name" htmlFor="business">
                <input
                  id="business"
                  name="business"
                  type="text"
                  placeholder="Optional"
                  className={inputClasses}
                />
              </Field>
            </div>

            <Field label="Email" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@company.com"
                className={inputClasses}
              />
            </Field>

            <Field label="Industry" htmlFor="industry">
              <input
                id="industry"
                name="industry"
                type="text"
                placeholder="e.g. Construction, Finance, Advisory"
                className={inputClasses}
              />
            </Field>

            <fieldset>
              <legend className="mb-2.5 text-sm font-semibold text-ink-900">
                What are you interested in?
              </legend>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((interest) => {
                  const active = selectedInterests.includes(interest);
                  return (
                    <button
                      type="button"
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                        active
                          ? "border-green-900 bg-green-900 text-cream"
                          : "border-border bg-white text-ink-900 hover:border-green-900/40"
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <p className="text-xs leading-relaxed text-muted">
              Cymru Intelligence hasn&apos;t launched yet. This form is for
              expressing interest only &mdash; no account, dashboard or live
              data access is created when you submit it.
            </p>

            <button
              type="submit"
              className="w-full rounded-full bg-green-900 px-6 py-3.5 text-sm font-semibold text-cream transition-colors hover:bg-green-800"
            >
              Register interest
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const inputClasses =
  "w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-muted/70 outline-none transition-colors focus:border-green-800";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink-900">
        {label}
      </label>
      {children}
    </div>
  );
}
