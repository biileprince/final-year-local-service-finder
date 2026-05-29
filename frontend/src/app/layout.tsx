import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "@/styles/globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { SearchOverlayProvider } from "@/components/search/search-trigger";
import { CookieConsent } from "@/components/layout/cookie-consent";
import {
  ThemeProvider,
  themeNoFlashScript,
} from "@/components/theme/theme-provider";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { PostHogProvider } from "@/components/analytics/posthog-provider";

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Local Service Finder - Find Trusted Service Providers in Ghana",
    template: "%s | Local Service Finder",
  },
  description:
    "Connect with verified local service providers in Ghana. Book plumbers, electricians, cleaners, and more with ease.",
  keywords: [
    "local services",
    "Ghana",
    "service providers",
    "plumber",
    "electrician",
    "cleaner",
    "handyman",
    "booking",
  ],
  authors: [{ name: "Local Service Finder" }],
  creator: "Local Service Finder",
  openGraph: {
    type: "website",
    locale: "en_GH",
    siteName: "Local Service Finder",
    title: "Local Service Finder - Find Trusted Service Providers in Ghana",
    description:
      "Connect with verified local service providers in Ghana. Book plumbers, electricians, cleaners, and more with ease.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Local Service Finder",
    description: "Find trusted service providers in Ghana",
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: "Local Service Finder",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={roboto.variable}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Runs before hydration to apply the stored theme on the first paint
            (avoids the white→dark flicker). */}
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body
        className="min-h-screen bg-white font-sans antialiased text-gray-900"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <ToastProvider>
            <SearchOverlayProvider>
              {children}
              <CookieConsent />
              <InstallPrompt />
              <PostHogProvider />
            </SearchOverlayProvider>
          </ToastProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
