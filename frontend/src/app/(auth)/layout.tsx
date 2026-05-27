import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Shield, Star, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Account",
  description: "Sign in or create your Local Service Finder account.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Form panel */}
      <div className="flex w-full flex-col px-4 py-8 sm:px-6 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mb-10 flex items-center justify-between">
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
            href="/"
            className="text-sm font-semibold text-gray-500 transition-colors hover:text-gray-900"
          >
            ← Back home
          </Link>
        </div>

        <div className="flex flex-1 items-center">
          <div className="w-full">{children}</div>
        </div>

        <p className="mt-10 text-center text-xs text-gray-400 lg:text-left">
          &copy; {new Date().getFullYear()} Local Service Finder. Pay your
          service provider directly - we do not hold your money.
        </p>
      </div>

      {/* Photo panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 lg:items-center lg:justify-center">
        <Image
          src="https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80"
          alt="Hands at work"
          fill
          className="object-cover"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-white/85" />
        <div className="absolute inset-y-0 left-0 w-px bg-gray-200" />

        <div className="relative z-10 max-w-lg px-12 text-gray-900">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
            Simple and clear
          </p>
          <h2 className="mt-3 font-sans text-3xl font-bold leading-[1.15] tracking-tight">
            The right service provider,
            <br />
            <span className="text-primary-600">when you need help.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-gray-600">
            Verified service providers across Ghana, rated by people near you.
            Compare, book, and pay your service provider directly - no middlemen.
          </p>

          <ul className="mt-8 space-y-4">
            <Feature
              icon={Shield}
              title="Checked service providers"
              description="We check every service provider before they appear."
            />
            <Feature
              icon={Star}
              title="Rated by real customers"
              description="Honest reviews from your neighbors - not bots."
            />
            <Feature
              icon={Clock}
              title="Average reply under 2 hours"
              description="Fast replies from service providers who show up."
            />
          </ul>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="mt-0.5 text-sm text-gray-600">{description}</p>
      </div>
    </li>
  );
}
