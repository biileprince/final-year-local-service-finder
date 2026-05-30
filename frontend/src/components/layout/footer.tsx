import Image from "next/image";
import Link from "next/link";
import {
  Facebook,
  Twitter,
  Instagram,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

const footerLinks = {
  services: [
    { label: "Browse service providers", href: "/search" },
    { label: "All categories", href: "/categories" },
    { label: "For service providers", href: "/register?role=provider" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Blog", href: "/blog" },
    { label: "Press", href: "/press" },
  ],
  support: [
    { label: "Help center", href: "/help" },
    { label: "Contact", href: "/contact" },
    { label: "FAQs", href: "/faqs" },
    { label: "Status", href: "/status" },
  ],
  legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Cookies", href: "/cookies" },
  ],
};

const socials: { icon: LucideIcon; href: string; label: string }[] = [
  { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
  { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
];

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden bg-white text-secondary-700">
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <Link
              href="/"
              className="group inline-flex items-center gap-2.5"
              aria-label="Local Service Finder home"
            >
              <Image
                src="/images/local-service-finder-icon.png"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-xl object-contain"
              />
              <span className="flex flex-col leading-tight">
                <span className="font-sans text-base font-bold tracking-tight text-secondary-900">
                  Local Service
                </span>
                <span className="text-[10px] font-bold tracking-[0.2em] text-primary-600">
                  FINDER
                </span>
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-secondary-600">
              Verified plumbers, electricians, cleaners, and more across Ghana.
              Rated by people near you and ready to help.
            </p>

            <div className="mt-6 flex items-center gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-secondary-200 bg-white text-secondary-600 transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:text-primary-600"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <FooterColumn title="Services" links={footerLinks.services} />
          <FooterColumn title="Company" links={footerLinks.company} />
          <FooterColumn title="Support" links={footerLinks.support} />

          {/* Newsletter / CTA */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary-600">
              Get the app
            </p>
            <p className="mt-3 text-sm text-secondary-600">
              Book any service provider from your phone - coming soon to iOS and
              Android.
            </p>
            <Link
              href="/search"
              className="group mt-5 inline-flex items-center gap-1.5 rounded-xl border border-secondary-200 bg-secondary-900 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-secondary-800"
            >
              Find a service provider now
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* Contact strip */}
        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-secondary-200 pt-8 text-sm text-secondary-600">
          <ContactItem icon={MapPin}>Cape Coast, Ghana</ContactItem>
          <ContactItem icon={Phone}>+233 55 902 675</ContactItem>
          <ContactItem icon={Mail}>support@localservicefinder.com</ContactItem>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-secondary-200 pt-8 text-xs text-secondary-600 sm:flex-row sm:items-center">
          <p>
            &copy; {new Date().getFullYear()} Local Service Finder. All rights
            reserved.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {footerLinks.legal.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-semibold transition-colors hover:text-secondary-900"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-secondary-600">
        {title}
      </h3>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="inline-flex items-center py-1 text-sm font-semibold text-secondary-600 transition-colors hover:text-primary-600"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactItem({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary-600" />
      <span className="font-medium">{children}</span>
    </div>
  );
}
