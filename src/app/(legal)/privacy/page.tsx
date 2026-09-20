import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy | Cymru Intelligence",
  description: "How Cymru Intelligence handles personal data.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-ink-900">Privacy policy</h1>
      <p>Last updated: 20 September 2026</p>

      <p>
        This policy explains what personal data Cymru Intelligence collects, why, and what rights
        you have over it. It is written to be read, not to be skimmed past.
      </p>

      <h2>Who we are</h2>
      <p>
        Cymru Intelligence is an independent business intelligence service covering Wales. We are
        not affiliated with, endorsed by, or acting on behalf of any government body, whether or not
        we use data that body publishes.
      </p>

      <h2>What we collect about you</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your name, email address, optional job title and
          organisation, supplied when you register.
        </li>
        <li>
          <strong>Authentication data</strong> — handled by Supabase Auth. We never store your
          password; we hold only a reference to your auth identity.
        </li>
        <li>
          <strong>Usage records</strong> — searches, exports, reports and API calls, recorded so we
          can apply plan limits and show you your own usage.
        </li>
        <li>
          <strong>Your workspace</strong> — saved companies, saved searches and alerts you create.
        </li>
        <li>
          <strong>Billing data</strong> — handled by Stripe. We store a customer reference and
          subscription status; card details never reach our servers.
        </li>
        <li>
          <strong>Security logs</strong> — an audit trail of security-relevant actions, with IP
          addresses stored only as a hash.
        </li>
      </ul>

      <h2>What we do not collect</h2>
      <p>
        We do not use advertising trackers, we do not sell personal data, and we do not build
        profiles of you for any purpose beyond running the service you signed up for.
      </p>

      <h2>Public data about companies</h2>
      <p>
        Most of what this platform holds is public sector information about companies and public
        bodies — company registrations, contract notices, planning applications and funding
        schemes. That data is published by bodies such as Companies House and the Welsh Government
        under the Open Government Licence.
      </p>
      <p>
        Some of it names individuals, for example company officers and persons with significant
        control. That information is published by Companies House on the statutory public register;
        we reproduce it as published and link back to the source. If you believe a record about you
        is wrong, it must be corrected at the original publisher, because we reflect their register
        rather than maintaining our own.
      </p>

      <h2>Legal bases</h2>
      <ul>
        <li>
          <strong>Contract</strong> — to provide the service you have an account for.
        </li>
        <li>
          <strong>Legitimate interests</strong> — to keep the service secure, prevent abuse, and
          make public data more usable.
        </li>
        <li>
          <strong>Consent</strong> — for marketing email, which you can withdraw at any time.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Account data is kept while your account exists. Usage records are kept for up to 24 months
        so we can show usage history and investigate abuse. Audit logs are kept for up to 24 months.
        When you delete your account, your personal data is erased immediately as described below.
      </p>

      <h2>Your rights</h2>
      <p>
        You can exercise all of these yourself from <strong>Settings</strong> in your dashboard:
      </p>
      <ul>
        <li>
          <strong>Access</strong> — download everything we hold about you as JSON.
        </li>
        <li>
          <strong>Erasure</strong> — delete your account. This removes your profile, saved
          companies, alerts and saved searches, revokes your API keys and deletes your sign-in
          credentials.
        </li>
        <li>
          <strong>Rectification</strong> — update your profile at any time.
        </li>
        <li>
          <strong>Objection and restriction</strong> — turn off any category of email.
        </li>
      </ul>
      <p>
        You also have the right to complain to the Information Commissioner&rsquo;s Office (ICO).
      </p>

      <h2>Processors we use</h2>
      <ul>
        <li>
          <strong>Supabase</strong> — database hosting and authentication.
        </li>
        <li>
          <strong>Stripe</strong> — payment processing.
        </li>
        <li>
          <strong>Resend</strong> — transactional and alert email.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We set a session cookie so you stay signed in, and nothing else. There are no analytics or
        advertising cookies, so there is no cookie banner to dismiss.
      </p>

      <h2>Contact</h2>
      <p>
        For any privacy question, email{" "}
        <a href="mailto:privacy@cymru-intelligence.wales" className="text-accent-green hover:underline">
          privacy@cymru-intelligence.wales
        </a>
        .
      </p>
    </>
  );
}
