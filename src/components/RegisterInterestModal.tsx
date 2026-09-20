"use client";

import { useEffect, useState, useTransition } from "react";

import { registerInterest } from "@/app/actions/register-interest";
import { useRegisterInterest } from "@/context/RegisterInterestContext";

const INTERESTS = [
  "Business intelligence",
  "Planning",
  "Procurement",
  "Funding",
  "Companies",
  "Economic data",
];

export default function RegisterInterestModal() {
  const { isOpen, closeModal } = useRegisterInterest();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        setError(null);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setError(null);
      const result = await registerInterest(formData);
      if (result.ok) setSubmitted(true);
      else setError(result.error ?? "Something went wrong.");
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <button
        aria-label="Close"
        onClick={closeModal}
        className="fixed inset-0 bg-green-900/75 backdrop-blur-sm"
      />

      <div className="relative z-10 my-8 w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-ink-900 shadow-2xl sm:p-8">
        <button
          onClick={closeModal}
          aria-label="Close"
          className="absolute right-5 top-5 rounded-full p-2 text-muted hover:text-ink-900 focus:outline-none"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {!submitted ? (
          <>
            <div className="mb-6 space-y-2">
              <h3 className="text-2xl font-bold text-ink-900">Register interest</h3>
              <p className="text-sm text-muted">
                Be the first to know when Cymru Intelligence launches.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="f-name" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-900">
                  Full Name *
                </label>
                <input id="f-name" name="name" type="text" required placeholder="Jane Davies" className={inputClasses} />
              </div>

              <div>
                <label htmlFor="f-business" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-900">
                  Business / Organisation Name
                </label>
                <input id="f-business" name="business" type="text" placeholder="Welsh Enterprise Ltd" className={inputClasses} />
              </div>

              <div>
                <label htmlFor="f-email" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-900">
                  Email Address *
                </label>
                <input id="f-email" name="email" type="email" required placeholder="jane@example.co.uk" className={inputClasses} />
              </div>

              <div>
                <label htmlFor="f-industry" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-900">
                  Industry
                </label>
                <select id="f-industry" name="industry" defaultValue="" className={inputClasses}>
                  <option value="">Select industry sector...</option>
                  <option value="planning">Construction &amp; Real Estate</option>
                  <option value="public">Public Sector &amp; Government</option>
                  <option value="finance">Finance &amp; Investment</option>
                  <option value="advisory">Consulting &amp; Advisory</option>
                  <option value="tech">Technology &amp; Media</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-900">
                  What are you interested in?
                </legend>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {INTERESTS.map((interest) => (
                    <label
                      key={interest}
                      className="flex cursor-pointer items-center gap-2 rounded border border-border bg-white p-2 hover:bg-gray-50"
                    >
                      <input type="checkbox" name="interests" value={interest} className="rounded text-ink-900" />
                      <span>{interest}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-md bg-green-900 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-green-800 disabled:opacity-60"
                >
                  {isPending ? "Registering…" : "Register interest"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="space-y-4 py-8 text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-ink-900">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-ink-900">Diolch / Thank you!</h3>
            <p className="mx-auto max-w-sm text-sm text-muted">
              Your interest in Cymru Intelligence has been recorded. This is a
              pre-launch preview, so nothing has been saved to a live system
              &mdash; we will be in touch with updates prior to our official
              launch.
            </p>
            <button
              onClick={closeModal}
              className="mt-4 rounded-md bg-cream-button px-6 py-2.5 text-sm font-bold text-ink-900 transition-colors hover:bg-cream-hover"
            >
              Close window
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClasses =
  "w-full rounded-md border border-border bg-white px-4 py-2.5 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-green-900";
