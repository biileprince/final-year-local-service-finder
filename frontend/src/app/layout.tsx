import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
import "@/styles/globals.css";

const bodyFont = Atkinson_Hyperlegible({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "700"],
  display: "swap",
});

const headingFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${headingFont.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className="min-h-screen bg-white font-sans antialiased text-gray-900"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
