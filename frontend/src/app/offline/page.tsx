import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500 text-2xl font-bold text-white">
        LSF
      </div>
      <h1 className="text-2xl font-bold text-secondary-900">
        You&apos;re offline
      </h1>
      <p className="max-w-md text-secondary-600">
        We can&apos;t reach the network right now. Check your connection and try
        again — pages you&apos;ve already visited may still work.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-700"
      >
        Try the homepage
      </Link>
    </div>
  );
}
