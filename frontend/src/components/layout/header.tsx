"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Menu,
  X,
  Search,
  Bell,
  User,
  LogOut,
  Calendar,
  Settings,
  ChevronDown,
  Wrench,
  Zap,
  Sparkles,
  Hammer,
  Wind,
  Paintbrush,
  ArrowRight,
  Shield,
  Star,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks";

interface ServiceItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

const servicesPrimary: ServiceItem[] = [
  {
    name: "Plumbing",
    icon: Wrench,
    href: "/search?category=plumbing",
    description: "Leaks, installs, drainage and water systems.",
  },
  {
    name: "Electrical",
    icon: Zap,
    href: "/search?category=electrical",
    description: "Wiring, outlets, panels and inspections.",
  },
  {
    name: "Cleaning",
    icon: Sparkles,
    href: "/search?category=cleaning",
    description: "Deep cleans, regular service and move-out.",
  },
];

const servicesSecondary: ServiceItem[] = [
  {
    name: "Handyman",
    icon: Hammer,
    href: "/search?category=handyman",
    description: "Repairs, mounting, assembly and small fixes.",
  },
  {
    name: "HVAC",
    icon: Wind,
    href: "/search?category=hvac",
    description: "AC service, heating, ventilation and tune-ups.",
  },
  {
    name: "Painting",
    icon: Paintbrush,
    href: "/search?category=painting",
    description: "Interior, exterior and decorative finishes.",
  },
];

const directLinks = [
  { name: "How it works", href: "/#how-it-works" },
  { name: "For providers", href: "/register?role=provider" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [scrolled, setScrolled] = useState(false);

  const servicesRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        servicesRef.current &&
        !servicesRef.current.contains(e.target as Node)
      ) {
        setServicesOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setServicesOpen(false);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    router.push("/");
  };

  const submitSearch = (value: string) => {
    const q = value.trim();
    if (!q) return router.push("/search");
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const isActiveLink = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#")) return false;
    if (href.startsWith("/register")) return pathname === "/register";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const openServices = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setServicesOpen(true);
  };

  const queueCloseServices = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setServicesOpen(false), 120);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-gray-200/80 bg-white/85 shadow-sm backdrop-blur-md"
          : "border-b border-transparent bg-white",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:h-20 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label="Local Service Finder home"
        >
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-primary-500 to-primary-600 shadow-md transition-all group-hover:shadow-lg group-hover:shadow-primary-500/30">
            <Search className="h-5 w-5 text-white" strokeWidth={2.5} />
            <span
              aria-hidden
              className="absolute -inset-px rounded-xl ring-1 ring-inset ring-white/30"
            />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-sans text-sm font-bold tracking-tight text-gray-900 sm:text-base">
              Local Service
            </span>
            <span className="text-[9px] font-bold tracking-[0.2em] text-primary-500 sm:text-[10px]">
              FINDER
            </span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          <Link
            href="/"
            className={cn(
              "rounded-lg px-4 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
              isActiveLink("/")
                ? "text-primary-600"
                : "text-gray-700 hover:text-gray-900",
            )}
          >
            Home
          </Link>

          {/* Services mega menu */}
          <div
            className="relative"
            ref={servicesRef}
            onMouseEnter={openServices}
            onMouseLeave={queueCloseServices}
          >
            <button
              type="button"
              onClick={() => setServicesOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={servicesOpen}
              className={cn(
                "flex items-center gap-1 rounded-lg px-4 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                servicesOpen
                  ? "text-primary-600"
                  : "text-gray-700 hover:text-gray-900",
              )}
            >
              Services
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  servicesOpen && "rotate-180 text-primary-500",
                )}
              />
            </button>

            {/* Mega panel */}
            <div
              role="menu"
              onMouseEnter={openServices}
              onMouseLeave={queueCloseServices}
              className={cn(
                "absolute left-1/2 top-full z-50 mt-3 w-[min(840px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-gray-200/80 bg-white/95 p-2 shadow-2xl backdrop-blur-xl transition-all duration-200",
                servicesOpen
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-1 opacity-0",
              )}
            >
              <div
                aria-hidden
                className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-tl-sm border-l border-t border-gray-200/80 bg-white"
              />

              <div className="grid grid-cols-1 gap-1 lg:grid-cols-[1fr_1fr_280px]">
                {/* Primary services column */}
                <div>
                  <p className="px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
                    Most booked
                  </p>
                  <div className="space-y-0.5">
                    {servicesPrimary.map((s) => (
                      <MegaItem key={s.name} item={s} />
                    ))}
                  </div>
                </div>

                {/* Secondary services column */}
                <div>
                  <p className="px-3 pb-2 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
                    More services
                  </p>
                  <div className="space-y-0.5">
                    {servicesSecondary.map((s) => (
                      <MegaItem key={s.name} item={s} />
                    ))}
                  </div>
                </div>

                {/* Featured promo tile */}
                <Link
                  href="/search"
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-linear-to-br from-gray-950 via-gray-900 to-primary-950 p-5 text-white transition-all hover:shadow-xl"
                >
                  <span
                    aria-hidden
                    className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary-500/30 blur-3xl"
                  />
                  <span
                    aria-hidden
                    className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-amber-500/20 blur-2xl"
                  />
                  <div className="relative">
                    <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-300">
                      <span className="h-1 w-1 animate-pulse rounded-full bg-primary-400" />
                      Browse all
                    </div>
                    <p className="font-sans text-lg font-bold leading-tight">
                      Find the right service provider for{" "}
                      <span className="italic text-primary-300">any job.</span>
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                      850+ verified service providers across 12 service
                      categories.
                    </p>
                  </div>
                  <div className="relative mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary-300 transition-all group-hover:gap-2.5">
                    See every category
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              </div>

              {/* Footer trust strip */}
              <div className="mt-2 grid grid-cols-3 divide-x divide-gray-100 rounded-xl bg-gray-50/60 px-2 py-2">
                <TrustChip
                  icon={Shield}
                  label="All service providers verified"
                />
                <TrustChip icon={Star} label="Rated 4.9 average" />
                <TrustChip icon={Clock} label="Avg. < 2h response" />
              </div>
            </div>
          </div>

          {/* Direct nav links */}
          {directLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "rounded-lg px-4 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                isActiveLink(link.href)
                  ? "text-primary-600"
                  : "text-gray-700 hover:text-gray-900",
              )}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="hidden items-center gap-2 lg:flex">
          {/* Compact search trigger */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch(searchValue);
            }}
            className="relative"
          >
            <label className="group flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition-all focus-within:border-primary-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-500/20 hover:border-gray-300">
              <Search className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-primary-500" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search…"
                className="w-32 bg-transparent font-medium outline-none placeholder:text-gray-400"
                aria-label="Search services"
              />
              <kbd className="hidden rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-400 xl:inline-block">
                ↵
              </kbd>
            </label>
          </form>

          {isAuthenticated && (
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative rounded-xl p-2.5 text-gray-700 transition-all hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              <Bell className="h-5 w-5" strokeWidth={2} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary-500 ring-2 ring-white" />
            </Link>
          )}

          {isAuthenticated && user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((s) => !s)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label="User menu"
                className="flex items-center gap-2 rounded-xl p-1.5 pr-2.5 transition-all hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary-500 to-primary-600 text-sm font-bold text-white shadow-sm">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-gray-500 transition-transform",
                    userMenuOpen && "rotate-180",
                  )}
                />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl"
                >
                  <div className="border-b border-gray-100 bg-linear-to-br from-primary-50 to-amber-50 p-4">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {user.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-600">
                      {user.email}
                    </p>
                  </div>
                  <div className="space-y-0.5 p-2">
                    <UserMenuLink
                      href="/bookings"
                      icon={Calendar}
                      label="My bookings"
                    />
                    {user.role === "PROVIDER" && (
                      <UserMenuLink
                        href="/dashboard"
                        icon={Settings}
                        label="Provider dashboard"
                      />
                    )}
                    <UserMenuLink href="/profile" icon={User} label="Profile" />
                    <UserMenuLink
                      href="/settings"
                      icon={Settings}
                      label="Settings"
                    />
                  </div>
                  <div className="border-t border-gray-100 p-2">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={2} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((s) => !s)}
          className="rounded-xl p-2.5 text-gray-700 transition-all hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 lg:hidden"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" strokeWidth={2.5} />
          ) : (
            <Menu className="h-6 w-6" strokeWidth={2.5} />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-gray-200 bg-white shadow-xl lg:hidden">
          <div className="space-y-6 px-4 py-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch(searchValue);
                setMobileMenuOpen(false);
              }}
            >
              <label className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20">
                <Search className="h-5 w-5 text-primary-500" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search services…"
                  className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-gray-500"
                  aria-label="Search services"
                />
              </label>
            </form>

            <nav className="space-y-1">
              <Link
                href="/"
                className={cn(
                  "block rounded-xl px-4 py-4 text-base font-semibold transition-all min-h-[48px] flex items-center font-sans",
                  isActiveLink("/")
                    ? "bg-primary-50 text-primary-600"
                    : "text-gray-700 hover:bg-gray-50",
                )}
              >
                Home
              </Link>
              <Link
                href="/search"
                className={cn(
                  "block rounded-xl px-4 py-4 text-base font-semibold transition-all min-h-[48px] flex items-center font-sans",
                  isActiveLink("/search")
                    ? "bg-primary-50 text-primary-600"
                    : "text-gray-700 hover:bg-gray-50",
                )}
              >
                Browse Services
              </Link>
              {directLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "block rounded-xl px-4 py-4 text-base font-semibold transition-all min-h-[48px] flex items-center font-sans",
                    isActiveLink(link.href)
                      ? "bg-primary-50 text-primary-600"
                      : "text-gray-700 hover:bg-gray-50",
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </nav>

            <div className="border-t border-gray-100 pt-5">
              <p className="mb-3 px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
                Services
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[...servicesPrimary, ...servicesSecondary].map((s) => (
                  <Link
                    key={s.name}
                    href={s.href}
                    className="flex items-center gap-2 rounded-xl border-2 border-transparent bg-gray-50 px-4 py-4 transition-all hover:border-primary-200 hover:bg-primary-50 min-h-[48px]"
                  >
                    <s.icon
                      className="h-5 w-5 text-primary-500"
                      strokeWidth={2}
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {s.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              {isAuthenticated && user ? (
                <div className="space-y-2">
                  <div className="rounded-xl bg-linear-to-br from-primary-50 to-amber-50 p-4">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-gray-600">
                      {user.email}
                    </p>
                  </div>
                  <MobileLink
                    href="/bookings"
                    icon={Calendar}
                    label="My bookings"
                  />
                  {user.role === "PROVIDER" && (
                    <MobileLink
                      href="/dashboard"
                      icon={Settings}
                      label="Provider dashboard"
                    />
                  )}
                  <MobileLink href="/profile" icon={User} label="Profile" />
                  <MobileLink
                    href="/settings"
                    icon={Settings}
                    label="Settings"
                  />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-5 w-5" />
                    Logout
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/login">Login</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href="/register">Register</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function MegaItem({ item }: { item: ServiceItem }) {
  return (
    <Link
      href={item.href}
      role="menuitem"
      className="group flex items-start gap-3 rounded-xl px-3 py-3 transition-all hover:bg-gray-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-primary-50 to-amber-50 text-primary-600 transition-all group-hover:from-primary-500 group-hover:to-primary-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-primary-500/30">
        <item.icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-gray-900 transition-colors group-hover:text-primary-600">
          {item.name}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-gray-500">
          {item.description}
        </span>
      </span>
    </Link>
  );
}

function TrustChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold text-gray-600">
      <Icon className="h-3.5 w-3.5 text-primary-500" />
      {label}
    </div>
  );
}

function UserMenuLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 hover:text-primary-600"
    >
      <Icon className="h-4 w-4 text-gray-400" />
      {label}
    </Link>
  );
}

function MobileLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50"
    >
      <Icon className="h-5 w-5 text-primary-500" />
      {label}
    </Link>
  );
}
