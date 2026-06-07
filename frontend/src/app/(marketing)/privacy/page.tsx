import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Local Service Finder collects, uses, and protects your personal information.",
  alternates: { canonical: "/privacy" },
};

const effectiveDate = "May 19, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-secondary-900">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-secondary-600">
          Effective {effectiveDate}
        </p>
      </header>

      <article className="prose prose-secondary max-w-none space-y-8 text-secondary-700">
        <section>
          <h2 className="text-xl font-bold text-secondary-900">1. Overview</h2>
          <p className="mt-3 leading-relaxed">
            Local Service Finder (&quot;we&quot;, &quot;us&quot;) operates an
            online marketplace that connects customers in Ghana with verified
            local service providers. This policy explains what personal
            information we collect, why we collect it, who we share it with,
            and the choices you have. It applies to our website, mobile
            experience, and related services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            2. Information we collect
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>
              <strong>Account data:</strong> name, email, phone number,
              password hash, role (customer or provider), and profile photo.
            </li>
            <li>
              <strong>Provider data:</strong> business name, bio, service
              location, hourly rate, gallery images, identity and business
              license documents submitted for verification.
            </li>
            <li>
              <strong>Booking data:</strong> service requested, schedule,
              messages and attachments exchanged with the other party, status,
              and any offline payment records you add.
            </li>
            <li>
              <strong>Reviews:</strong> ratings, written reviews, and any
              photos you choose to attach.
            </li>
            <li>
              <strong>Device & usage data:</strong> IP address, browser type,
              pages visited, approximate location (for &quot;near me&quot;
              search if you grant permission), and cookies (see our{" "}
              <Link href="/cookies" className="text-primary-600 hover:underline">
                Cookie Policy
              </Link>
              ).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            3. How we use your information
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>To create and maintain your account.</li>
            <li>
              To match customers with relevant providers and power search,
              typeahead, and trending features.
            </li>
            <li>
              To facilitate bookings, messaging, notifications, and review
              collection between users.
            </li>
            <li>
              To verify provider identity and protect the platform from fraud
              and abuse.
            </li>
            <li>
              To send transactional emails (account, verification, bookings,
              reviews) and, if you opt in, marketing updates.
            </li>
            <li>To analyse and improve our service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            4. Sharing your information
          </h2>
          <p className="mt-3 leading-relaxed">
            We share information with the other party in a booking or
            conversation (for example, a customer&apos;s contact details with
            the provider they have booked), and with service vendors who
            process data on our behalf:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>
              <strong>Resend</strong> — transactional email delivery.
            </li>
            <li>
              <strong>Cloudinary</strong> — image, document, and voice-note
              storage.
            </li>
            <li>
              <strong>Google</strong> — OAuth sign-in (only if you use the
              Google sign-in button).
            </li>
            <li>
              <strong>Heroku Postgres</strong> — primary database hosting.
            </li>
            <li>
              <strong>Mapbox</strong> — map tiles, geocoding (location
              search) and driving directions for the location features. When
              you load a map page, your IP and approximate viewport are sent
              to Mapbox.
            </li>
          </ul>
          <p className="mt-3 leading-relaxed">
            We do not sell personal information. We may disclose information
            if required by law, to protect our rights, or to comply with a
            legal request.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            5. Data retention
          </h2>
          <p className="mt-3 leading-relaxed">
            We keep account, booking, and review data for as long as your
            account is active and for a reasonable period afterwards in order
            to satisfy legal, tax, and dispute-resolution requirements.
            Verification tokens and password reset codes expire automatically
            (typically within 15 minutes). Audit logs are retained for
            security and compliance purposes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            6. Security
          </h2>
          <p className="mt-3 leading-relaxed">
            Passwords are stored using bcrypt hashing. Access tokens are
            short-lived; refresh tokens can be revoked on password change or
            from your settings. Traffic to the platform is encrypted with
            TLS. We follow industry-standard practices but cannot guarantee
            absolute security — please use a unique, strong password.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            7. Your rights and choices
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>
              You can update your profile, photo, and contact details at any
              time from{" "}
              <Link href="/profile" className="text-primary-600 hover:underline">
                /profile
              </Link>
              .
            </li>
            <li>
              You can manage email, SMS, and push preferences at{" "}
              <Link
                href="/settings/notifications"
                className="text-primary-600 hover:underline"
              >
                /settings/notifications
              </Link>
              .
            </li>
            <li>
              You can request a copy of your personal data or its deletion by
              emailing{" "}
              <a
                href="mailto:support@localservicefinder.com"
                className="text-primary-600 hover:underline"
              >
                support@localservicefinder.com
              </a>
              . We will respond within 30 days.
            </li>
            <li>
              You can revoke browser permissions (location, notifications) at
              any time from your browser settings.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            8. Children
          </h2>
          <p className="mt-3 leading-relaxed">
            The platform is not intended for users under 18. We do not
            knowingly collect data from children.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            9. Changes to this policy
          </h2>
          <p className="mt-3 leading-relaxed">
            We may update this policy from time to time. Material changes
            will be communicated by email or an in-app notice before they
            take effect. The &quot;effective&quot; date above always reflects
            the current version.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            10. Contact
          </h2>
          <p className="mt-3 leading-relaxed">
            Questions about this policy or a privacy request? Email{" "}
            <a
              href="mailto:support@localservicefinder.com"
              className="text-primary-600 hover:underline"
            >
              support@localservicefinder.com
            </a>
            .
          </p>
        </section>
      </article>
    </div>
  );
}
