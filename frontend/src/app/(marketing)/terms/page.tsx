import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The rules that govern your use of Local Service Finder as a customer or service provider.",
};

const effectiveDate = "May 19, 2026";

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-secondary-900">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-secondary-600">
          Effective {effectiveDate}
        </p>
      </header>

      <article className="prose prose-secondary max-w-none space-y-8 text-secondary-700">
        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            1. Acceptance of terms
          </h2>
          <p className="mt-3 leading-relaxed">
            By accessing or using Local Service Finder (&quot;the
            platform&quot;), you agree to these Terms of Service and our{" "}
            <Link href="/privacy" className="text-primary-600 hover:underline">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            2. The service
          </h2>
          <p className="mt-3 leading-relaxed">
            Local Service Finder is a marketplace that connects customers with
            independent local service providers in Ghana. We are not a party
            to the underlying service agreement between a customer and a
            provider. We do not perform any of the services listed on the
            platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            3. Eligibility and accounts
          </h2>
          <p className="mt-3 leading-relaxed">
            You must be at least 18 years old to use the platform. You are
            responsible for the accuracy of the information you provide,
            keeping your password secret, and all activity that takes place
            under your account. Notify us immediately at{" "}
            <a
              href="mailto:support@localservicefinder.com"
              className="text-primary-600 hover:underline"
            >
              support@localservicefinder.com
            </a>{" "}
            if you suspect unauthorised access.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            4. Customer responsibilities
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>
              Provide accurate booking details, including the address, date,
              and scope of work.
            </li>
            <li>
              Treat providers respectfully and arrive on time for confirmed
              appointments.
            </li>
            <li>
              Pay the agreed amount directly to the provider via cash, mobile
              money, bank transfer, or cheque. The platform does not process
              online payments.
            </li>
            <li>
              Leave reviews honestly and only after a service has actually
              been delivered.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            5. Provider responsibilities
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>
              Hold any licences, permits, or insurance required by Ghanaian
              law for the services you offer.
            </li>
            <li>
              Submit accurate verification documents. Misleading documents
              are grounds for permanent suspension.
            </li>
            <li>Honour confirmed bookings or cancel with reasonable notice.</li>
            <li>
              Provide services with professional skill and care, and comply
              with all applicable laws.
            </li>
            <li>
              Issue any required tax invoices or receipts to customers
              directly.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            6. Payments are offline
          </h2>
          <p className="mt-3 leading-relaxed">
            All payments are made offline (cash, mobile money, bank transfer,
            or cheque) directly between the customer and the provider. The
            platform may let you log a payment record for your own reference;
            this is informational and does not represent a transaction we
            have processed.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            7. Reviews and content
          </h2>
          <p className="mt-3 leading-relaxed">
            You retain ownership of the content you submit, but grant us a
            worldwide, royalty-free licence to display it on the platform. We
            may remove reviews or content that is abusive, defamatory,
            misleading, infringing, or otherwise in breach of these terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            8. Prohibited conduct
          </h2>
          <p className="mt-3 leading-relaxed">You agree not to:</p>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>Use the platform for any unlawful purpose.</li>
            <li>
              Impersonate another person or business, or misrepresent your
              affiliation.
            </li>
            <li>
              Circumvent the booking flow to defraud another user (for
              example, leaving the platform to avoid reviews).
            </li>
            <li>
              Scrape, copy, or harvest data from the platform by automated
              means.
            </li>
            <li>
              Interfere with the security, integrity, or availability of the
              platform.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            9. Suspension and termination
          </h2>
          <p className="mt-3 leading-relaxed">
            We may suspend or terminate your account for any breach of these
            terms or applicable law, or to protect other users. You may close
            your account at any time by contacting support.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            10. Disclaimer
          </h2>
          <p className="mt-3 leading-relaxed">
            The platform is provided &quot;as is&quot;. We do not warrant the
            quality, safety, legality, or accuracy of any service offered by
            a provider, the truthfulness of any listing or review, or that
            the platform will be uninterrupted or error-free.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            11. Limitation of liability
          </h2>
          <p className="mt-3 leading-relaxed">
            To the maximum extent permitted by law, Local Service Finder will
            not be liable for any indirect, incidental, special, or
            consequential damages arising from your use of the platform or
            from any service performed by a provider you found through the
            platform. Our aggregate liability under these terms will not
            exceed GHS 1,000.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            12. Governing law
          </h2>
          <p className="mt-3 leading-relaxed">
            These terms are governed by the laws of the Republic of Ghana.
            Any dispute will be resolved by the courts of Accra unless
            otherwise required by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            13. Changes to these terms
          </h2>
          <p className="mt-3 leading-relaxed">
            We may update these terms from time to time. Material changes
            will be communicated by email or in-app notice. Continued use of
            the platform after the effective date constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">14. Contact</h2>
          <p className="mt-3 leading-relaxed">
            Questions about these terms? Email{" "}
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
