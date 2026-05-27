import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Set up your provider profile",
  description: "Complete your Local Service Finder provider profile.",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-8">
          <Link
            href="/"
            className="group flex items-center gap-2.5"
            aria-label="Local Service Finder home"
          >
            <Image
              src="/images/local-service-finder-icon.png"
              alt=""
              width={40}
              height={40}
              priority
              className="h-10 w-10 shrink-0 rounded-xl object-contain transition-transform group-hover:scale-105"
            />
            <span className="flex flex-col leading-tight">
              <span className="font-sans text-base font-bold tracking-tight text-gray-900">
                Local Service
              </span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-primary-500">
                FINDER
              </span>
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-gray-500 transition-colors hover:text-gray-900"
          >
            Skip to dashboard
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-8 sm:py-16">
        <div className="w-full max-w-2xl">{children}</div>
      </main>

      <footer className="border-t border-gray-100 py-4">
        <p className="px-4 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Local Service Finder. Pay your
          service provider directly — we do not hold your money.
        </p>
      </footer>
    </div>
  );
}
