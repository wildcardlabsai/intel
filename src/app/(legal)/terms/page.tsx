import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of service | Cymru Intelligence",
  description: "Terms governing use of Cymru Intelligence.",
};

export default function TermsPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-ink-900">Terms of service</h1>
      <p>Last updated: 20 September 2026</p>

      <h2>1. The service</h2>
      <p>
        Cymru Intelligence aggregates public data about Welsh companies, public contracts, planning
        applications and funding, and makes it searchable. We are an independent service. Using
        data published by a government body does not make us affiliated with, endorsed by, or
        acting for that body.
      </p>

      <h2>2. Accuracy and its limits</h2>
      <p>
        We reproduce what publishers publish. We normalise and connect records, but we do not
        verify them, and we do not correct them. Where we link records from different sources —
        matching a contract supplier to a registered company, for example — we show the confidence
        of that match, and we leave records unmatched rather than guess.
      </p>
      <p>
        <strong>
          Nothing here is a substitute for your own due diligence, and nothing here is financial,
          legal or investment advice.
        </strong>{" "}
        Always check the original source before acting on a record. Every record links to it.
      </p>
      <p>
        Coverage is partial and we say so on the relevant pages. Welsh planning data in particular
        is published separately by 25 authorities, and only those with a configured feed appear.
      </p>

      <h2>3. Your account</h2>
      <p>
        You are responsible for keeping your credentials and API keys secure, and for activity
        carried out with them. Tell us immediately if you believe a key has been exposed; you can
        revoke keys yourself at any time.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You must not:</p>
      <ul>
        <li>attempt to circumvent plan limits, rate limits or access controls;</li>
        <li>scrape the interface rather than using the API provided for programmatic access;</li>
        <li>resell or redistribute bulk data in breach of the underlying publisher&rsquo;s licence;</li>
        <li>use the service to harass individuals named in public registers;</li>
        <li>use it for any unlawful purpose.</li>
      </ul>

      <h2>5. Data licensing and attribution</h2>
      <p>
        Most data on this platform is public sector information licensed under the Open Government
        Licence v3.0. If you redistribute it, you must attribute it as that licence requires. Every
        record and every API response carries its source and the original URL so attribution is
        always possible.
      </p>
      <p>
        Postcode data contains OS data © Crown copyright and database right, and Royal Mail and ONS
        copyright.
      </p>

      <h2>6. Subscriptions and payment</h2>
      <p>
        Paid plans are billed in advance through Stripe. Plan limits are enforced per calendar
        month. You can cancel at any time through the billing portal; access continues to the end
        of the paid period. We do not refund part-used periods unless required by law.
      </p>
      <p>
        We may change pricing with at least 30 days&rsquo; notice. Existing subscriptions continue
        at their current price until the next renewal after that notice.
      </p>

      <h2>7. Availability</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted service. Data freshness
        depends on publishers: if a publisher&rsquo;s feed is unavailable, that data will be stale,
        and the affected pages show when each source last synced.
      </p>

      <h2>8. Liability</h2>
      <p>
        To the extent permitted by law, we are not liable for indirect or consequential loss, or
        for loss arising from reliance on a record without checking its source. Nothing in these
        terms limits liability for death, personal injury or fraud.
      </p>

      <h2>9. Termination</h2>
      <p>
        You can delete your account at any time from Settings. We may suspend an account that
        breaches these terms, and will explain why where we lawfully can.
      </p>

      <h2>10. Governing law</h2>
      <p>These terms are governed by the law of England and Wales.</p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:hello@cymru-intelligence.wales" className="text-accent-green hover:underline">
          hello@cymru-intelligence.wales
        </a>
      </p>
    </>
  );
}
