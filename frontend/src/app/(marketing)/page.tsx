import Image from "next/image";
import Link from "next/link";
import {
  Search,
  Shield,
  Clock,
  Star,
  ArrowRight,
  CheckCircle,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PopularServices } from "@/components/home/popular-services";
import { TrendingNow } from "@/components/home/trending-now";

const heroBgImage =
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1800&q=80";
const heroImage =
  "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1400&q=80";
const stepsImage =
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80";
const ctaImage =
  "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=1800&q=80";

const heroStats = [
  { label: "Verified service providers", value: "850+" },
  { label: "Average reply time", value: "Under 2 hours" },
  { label: "Bookings made", value: "12k+" },
];

const serviceChips = [
  "Plumbing",
  "Electrical",
  "Cleaning",
  "Painting",
  "Carpentry",
  "AC Repair",
  "Handyman",
  "Laundry",
  "Gardening",
  "Pest Control",
  "Moving",
  "Beauty",
  "Tutoring",
  "Auto Repair",
  "Catering",
  "Photography",
];

interface LocationStat {
  location: string;
  providerCount: number;
}

async function fetchTopLocations(): Promise<LocationStat[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${apiUrl}/search/locations?limit=8`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return (await res.json()) as LocationStat[];
  } catch {
    return [];
  }
}

const howItWorksCustomer = [
  {
    title: "Search for a service or a provider",
    description:
      "Type the service you need and your location so we can show nearby options.",
  },
  {
    title: "Compare profiles and prices",
    description:
      "Read reviews, check ratings, and see prices before you choose.",
  },
  {
    title: "Book and message",
    description:
      "Pick a day and time, then message the service provider if you have questions.",
  },
];

const howItWorksProvider = [
  {
    title: "Create a profile",
    description:
      "Add your name, contact details, location, and the services you offer.",
  },
  {
    title: "List your services",
    description:
      "Set your prices and the areas you can serve so customers can find you.",
  },
  {
    title: "Get booking requests",
    description:
      "Reply to customers, confirm bookings, and get paid after the job.",
  },
];

const benefits = [
  {
    icon: Shield,
    title: "Verified service providers",
    description:
      "We check service providers before they appear on the platform.",
  },
  {
    icon: Star,
    title: "Real reviews",
    description:
      "Read feedback from real customers so you can choose with confidence.",
  },
  {
    icon: Clock,
    title: "Fast response",
    description:
      "Many service providers respond quickly, so you can book without delay.",
  },
];

export default async function HomePage() {
  const topLocations = await fetchTopLocations();
  return (
    <div className="bg-white">
      {/* ====== Hero ====== */}
      <section className="relative overflow-hidden bg-white">
        <Image
          src={heroBgImage}
          alt=""
          fill
          className="object-cover opacity-10"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-white/85" />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-8 sm:pb-32 sm:pt-24 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-secondary-500">
                Local Service Finder
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-secondary-900 sm:text-5xl lg:text-6xl">
                Find and book trusted service providers in Ghana
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-secondary-600">
                Local Service Finder helps you find plumbers, electricians,
                cleaners, painters, carpenters, and more. If you provide a
                service, you can create a profile and list the services you
                offer so customers can find you.
              </p>

              {/* Search form */}
              <form
                action="/search"
                method="get"
                className="mt-8 rounded-2xl border border-secondary-200 bg-white p-4 shadow-sm"
              >
                <div className="grid items-end gap-4 sm:grid-cols-[1.2fr_1fr_auto]">
                  <div>
                    <label
                      htmlFor="home-service"
                      className="text-sm font-semibold text-secondary-600"
                    >
                      Service
                    </label>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3">
                      <Search className="h-5 w-5 text-secondary-400" />
                      <input
                        id="home-service"
                        name="q"
                        type="text"
                        placeholder="Plumber, electrician, cleaning"
                        className="w-full bg-transparent text-base font-medium text-secondary-900 outline-none placeholder:text-secondary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="home-location"
                      className="text-sm font-semibold text-secondary-600"
                    >
                      Location
                    </label>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3">
                      <MapPin className="h-5 w-5 text-secondary-400" />
                      <input
                        id="home-location"
                        name="location"
                        type="text"
                        placeholder="Accra, Kumasi, Takoradi"
                        className="w-full bg-transparent text-base font-medium text-secondary-900 outline-none placeholder:text-secondary-500"
                      />
                    </div>
                  </div>
                  <Button type="submit" size="lg" className="w-full sm:w-auto">
                    Search services
                  </Button>
                </div>
                <p className="mt-4 text-sm text-secondary-500">
                  You can search by service name or service provider name.
                </p>
              </form>

              {/* Service chips */}
              <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-secondary-600">
                <span className="font-semibold text-secondary-700">
                  Common services:
                </span>
                {serviceChips.map((service) => (
                  <Link
                    key={service}
                    href={`/search?category=${service.toLowerCase()}`}
                    className="rounded-full border border-secondary-200 bg-white px-4 py-2 font-medium transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
                  >
                    {service}
                  </Link>
                ))}
              </div>

              {/* Provider CTA */}
              <div className="mt-8 rounded-2xl border border-secondary-200 bg-secondary-50 p-6">
                <p className="text-base font-bold text-secondary-900">
                  For service providers
                </p>
                <p className="mt-2 text-base text-secondary-600">
                  Create a profile, list your services, set your prices, and get
                  bookings from customers near you.
                </p>
                <Button variant="outline" size="lg" asChild className="mt-4">
                  <Link href="/register?role=provider">
                    Register as a service provider
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>

              {/* Stats */}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-secondary-200 bg-white p-4"
                  >
                    <p className="text-lg font-bold text-secondary-900">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm text-secondary-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero image */}
            <div className="relative">
              <div className="overflow-hidden rounded-3xl border border-secondary-200 bg-white shadow-sm">
                <Image
                  src={heroImage}
                  alt="Service provider at work"
                  width={1000}
                  height={760}
                  className="h-auto w-full object-cover"
                  priority
                />
              </div>
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-secondary-700 shadow-sm">
                <CheckCircle className="h-4 w-4 text-primary-600" />
                Verified service providers
              </div>
              <div className="absolute bottom-4 right-4 rounded-2xl bg-white px-4 py-3 shadow-sm">
                <p className="font-bold text-secondary-900">Easy booking</p>
                <p className="text-sm text-secondary-500">Pick a day and time</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PopularServices />

      <TrendingNow />

      {/* ====== How it works ====== */}
      <section id="how-it-works" className="relative bg-secondary-50 py-24">
        <Image
          src={stepsImage}
          alt=""
          fill
          className="object-cover opacity-5"
          sizes="100vw"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-8 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold text-secondary-900 sm:text-4xl">
              How it works for customers and service providers
            </h2>
            <p className="mt-4 text-lg text-secondary-600">
              The steps are simple and clear so everyone can use the platform.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            {/* Customer steps */}
            <div className="rounded-3xl border border-secondary-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600">
                For customers
              </p>
              <h3 className="mt-2 text-2xl font-bold text-secondary-900">
                Find help and book a service
              </h3>
              <ol className="mt-8 space-y-6">
                {howItWorksCustomer.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-600 text-base font-bold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-secondary-900">
                        {step.title}
                      </p>
                      <p className="mt-1 text-base text-secondary-600">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Provider steps */}
            <div className="rounded-3xl border border-secondary-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600">
                For service providers
              </p>
              <h3 className="mt-2 text-2xl font-bold text-secondary-900">
                List your services and get bookings
              </h3>
              <ol className="mt-8 space-y-6">
                {howItWorksProvider.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-600 text-base font-bold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-secondary-900">
                        {step.title}
                      </p>
                      <p className="mt-1 text-base text-secondary-600">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ====== Benefits ====== */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h2 className="text-3xl font-bold text-secondary-900 sm:text-4xl">
                Why people use Local Service Finder
              </h2>
              <p className="mt-4 text-lg text-secondary-600">
                We make it easy to find trusted service providers and book a
                service with clear information.
              </p>
              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                {benefits.map((benefit) => (
                  <div
                    key={benefit.title}
                    className="rounded-2xl border border-secondary-200 bg-white p-6 shadow-soft"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
                      <benefit.icon className="h-6 w-6 text-primary-600" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-secondary-900">
                      {benefit.title}
                    </h3>
                    <p className="mt-2 text-base text-secondary-600">
                      {benefit.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-secondary-200 bg-secondary-50 p-8">
              <div className="flex items-center gap-2 text-base font-semibold text-secondary-700">
                <MapPin className="h-5 w-5 text-primary-600" />
                Across Ghana
              </div>
              <h3 className="mt-4 text-2xl font-bold text-secondary-900">
                Find service providers close to you
              </h3>
              <p className="mt-4 text-base text-secondary-600">
                Search by area or service. You can message a service provider
                and ask questions before you book.
              </p>
              <div className="mt-8 rounded-2xl border border-secondary-200 bg-white p-2">
                {topLocations.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-secondary-500">
                    Provider locations will appear here once available.
                  </p>
                ) : (
                  <ul className="divide-y divide-secondary-100">
                    {topLocations.map((loc) => (
                      <li key={loc.location}>
                        <Link
                          href={`/search?location=${encodeURIComponent(loc.location)}`}
                          className="group flex items-center justify-between rounded-xl px-4 py-3 text-base transition-colors hover:bg-primary-50"
                        >
                          <span className="flex items-center gap-2 font-bold text-secondary-900 group-hover:text-primary-700">
                            <MapPin className="h-4 w-4 text-primary-500" />
                            {loc.location}
                          </span>
                          <span className="flex items-center gap-2 text-sm font-medium text-secondary-500 group-hover:text-primary-600">
                            {loc.providerCount} provider
                            {loc.providerCount === 1 ? "" : "s"}
                            <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-3 text-xs text-secondary-500">
                Tap a city to see local providers there.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ====== CTA ====== */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-8">
          <div className="grid gap-12 rounded-3xl border border-secondary-200 bg-secondary-50 p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-12">
            <div>
              <h2 className="text-3xl font-bold text-secondary-900 sm:text-4xl">
                Ready to book a service or list your services?
              </h2>
              <p className="mt-6 text-lg text-secondary-600">
                Customers can find trusted service providers and book a time.
                Service providers can create a profile, list services, and get
                new customers.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Button size="xl" asChild>
                  <Link href="/search">Find a service provider</Link>
                </Button>
                <Button size="xl" variant="outline" asChild>
                  <Link href="/register?role=provider">
                    Register as a provider
                  </Link>
                </Button>
              </div>
              <div className="mt-8 space-y-4 text-base text-secondary-600">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 shrink-0 text-primary-600" />
                  Clear profiles and real reviews
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 shrink-0 text-primary-600" />
                  Talk to a service provider before you book
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 shrink-0 text-primary-600" />
                  Pay the service provider directly after the work
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-secondary-200 bg-white">
              <Image
                src={ctaImage}
                alt="Customer speaking with a service provider"
                width={900}
                height={720}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
