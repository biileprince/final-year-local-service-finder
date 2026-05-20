import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "What cookies and similar storage Local Service Finder uses, and how to control them.",
};

const effectiveDate = "May 19, 2026";

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-secondary-900">
          Cookie Policy
        </h1>
        <p className="mt-3 text-sm text-secondary-600">
          Effective {effectiveDate}
        </p>
      </header>

      <article className="prose prose-secondary max-w-none space-y-8 text-secondary-700">
        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            1. What we use
          </h2>
          <p className="mt-3 leading-relaxed">
            Local Service Finder uses a small number of cookies and similar
            browser storage (localStorage) to keep you signed in, remember
            your preferences, and improve the experience.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            2. Categories
          </h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-secondary-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary-50 text-xs font-bold uppercase tracking-wider text-secondary-700">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Required?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200 bg-white">
                <tr>
                  <td className="px-4 py-3 font-semibold text-secondary-900">
                    Strictly necessary
                  </td>
                  <td className="px-4 py-3">
                    Authentication tokens, session state, CSRF protection,
                    consent record itself.
                  </td>
                  <td className="px-4 py-3">Yes</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-secondary-900">
                    Functional
                  </td>
                  <td className="px-4 py-3">
                    Theme (light/dark), recent searches, dismissed banners.
                  </td>
                  <td className="px-4 py-3">No</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-secondary-900">
                    Analytics
                  </td>
                  <td className="px-4 py-3">
                    Aggregate usage (not yet enabled at launch; will appear
                    here if added).
                  </td>
                  <td className="px-4 py-3">No</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            3. Specific keys we set
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
            <li>
              <code className="rounded bg-secondary-100 px-1.5 py-0.5 text-xs">
                accessToken
              </code>
              ,{" "}
              <code className="rounded bg-secondary-100 px-1.5 py-0.5 text-xs">
                refreshToken
              </code>
              ,{" "}
              <code className="rounded bg-secondary-100 px-1.5 py-0.5 text-xs">
                auth-storage
              </code>{" "}
              — keep you signed in.
            </li>
            <li>
              <code className="rounded bg-secondary-100 px-1.5 py-0.5 text-xs">
                lsf:theme
              </code>{" "}
              — your light/dark theme preference.
            </li>
            <li>
              <code className="rounded bg-secondary-100 px-1.5 py-0.5 text-xs">
                lsf:cookie-consent
              </code>{" "}
              — your response to the cookie banner.
            </li>
            <li>
              <code className="rounded bg-secondary-100 px-1.5 py-0.5 text-xs">
                lsf:recent-searches:v1
              </code>{" "}
              — your six most-recent searches for the typeahead overlay.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            4. Your choices
          </h2>
          <p className="mt-3 leading-relaxed">
            You can clear cookies and local storage at any time from your
            browser settings. Note that clearing them will sign you out and
            reset your preferences. Strictly-necessary cookies cannot be
            disabled while you use the platform — they are essential to
            authentication and basic security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            5. Third parties
          </h2>
          <p className="mt-3 leading-relaxed">
            We do not embed third-party advertising or social-media tracking
            scripts. The Google sign-in flow uses Google&apos;s own cookies
            when you click &quot;Continue with Google&quot;; their use is
            governed by Google&apos;s privacy policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-secondary-900">
            6. More information
          </h2>
          <p className="mt-3 leading-relaxed">
            See our{" "}
            <Link href="/privacy" className="text-primary-600 hover:underline">
              Privacy Policy
            </Link>{" "}
            for the wider picture of how we handle personal information, or
            contact{" "}
            <a
              href="mailto:support@localservicefinder.com"
              className="text-primary-600 hover:underline"
            >
              support@localservicefinder.com
            </a>{" "}
            with any questions.
          </p>
        </section>
      </article>
    </div>
  );
}
