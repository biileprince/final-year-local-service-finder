import Link from "next/link";
import { Search, Shield, Clock, Star, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Shield,
    title: "Verified Providers",
    description: "All service providers are thoroughly vetted and verified for your peace of mind.",
  },
  {
    icon: Clock,
    title: "Quick Booking",
    description: "Book services in minutes with our easy-to-use platform. No hassle, no waiting.",
  },
  {
    icon: Star,
    title: "Quality Guaranteed",
    description: "Read reviews from real customers and choose the best providers for your needs.",
  },
];

const popularCategories = [
  { name: "Plumbing", icon: "🔧", count: 150 },
  { name: "Electrical", icon: "⚡", count: 120 },
  { name: "Cleaning", icon: "🧹", count: 200 },
  { name: "Painting", icon: "🎨", count: 80 },
  { name: "Carpentry", icon: "🪚", count: 90 },
  { name: "AC Repair", icon: "❄️", count: 70 },
];

const howItWorks = [
  {
    step: "1",
    title: "Search for a Service",
    description: "Browse categories or search for the specific service you need.",
  },
  {
    step: "2",
    title: "Choose a Provider",
    description: "Compare providers based on ratings, reviews, and pricing.",
  },
  {
    step: "3",
    title: "Book & Relax",
    description: "Schedule your appointment and let the professional handle the rest.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-accent-50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-secondary-900 sm:text-5xl lg:text-6xl">
              Find Trusted{" "}
              <span className="text-primary-600">Local Services</span>
              <br />
              in Ghana
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-secondary-600">
              Connect with verified local service providers. From plumbers to
              electricians, cleaners to carpenters – find the help you need in minutes.
            </p>

            {/* Search Bar */}
            <div className="mx-auto mt-10 max-w-xl">
              <div className="flex gap-2 rounded-xl bg-white p-2 shadow-lg">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary-400" />
                  <input
                    type="text"
                    placeholder="What service do you need?"
                    className="h-12 w-full rounded-lg bg-secondary-50 pl-10 pr-4 text-secondary-900 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <Button size="lg" asChild>
                  <Link href="/search">Search</Link>
                </Button>
              </div>
              <p className="mt-3 text-sm text-secondary-500">
                Popular: Plumber, Electrician, House Cleaning, AC Repair
              </p>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-primary-100 opacity-50 blur-3xl" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent-100 opacity-50 blur-3xl" />
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-secondary-900">
              Why Choose LocalService?
            </h2>
            <p className="mt-4 text-lg text-secondary-600">
              We make finding and booking local services simple and reliable.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="text-center">
                <CardContent className="pt-6">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary-100">
                    <feature.icon className="h-7 w-7 text-primary-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-secondary-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-secondary-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Categories */}
      <section className="bg-secondary-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold text-secondary-900">
                Popular Categories
              </h2>
              <p className="mt-2 text-secondary-600">
                Explore our most requested services
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/categories">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {popularCategories.map((category) => (
              <Link
                key={category.name}
                href={`/search?category=${category.name.toLowerCase()}`}
                className="group rounded-xl bg-white p-6 text-center shadow-soft transition-all hover:-translate-y-1 hover:shadow-soft-lg"
              >
                <span className="text-4xl">{category.icon}</span>
                <h3 className="mt-3 font-medium text-secondary-900 group-hover:text-primary-600">
                  {category.name}
                </h3>
                <p className="mt-1 text-sm text-secondary-500">
                  {category.count}+ providers
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-secondary-900">How It Works</h2>
            <p className="mt-4 text-lg text-secondary-600">
              Get started in three simple steps
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {howItWorks.map((item, index) => (
              <div key={item.step} className="relative text-center">
                {index < howItWorks.length - 1 && (
                  <div className="absolute left-1/2 top-8 hidden h-0.5 w-full bg-primary-100 md:block" />
                )}
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-600 text-2xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-6 text-lg font-semibold text-secondary-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-secondary-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary-600 py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">
            Ready to Find Your Perfect Service Provider?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
            Join thousands of satisfied customers who have found reliable local
            services through our platform.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/search">Find Services</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
              asChild
            >
              <Link href="/register?role=provider">Become a Provider</Link>
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-white">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary-200" />
              <span>Free to use</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary-200" />
              <span>No hidden fees</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary-200" />
              <span>Verified providers</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
