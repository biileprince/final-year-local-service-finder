import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Local Service Finder account",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Form */}
      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-20 xl:px-24">
        {children}
      </div>

      {/* Right Panel - Branding */}
      <div className="relative hidden lg:flex lg:w-1/2 lg:items-center lg:justify-center lg:bg-primary-600">
        <div className="relative z-10 max-w-lg px-8 text-center">
          <div className="mb-8 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white">
              <span className="text-3xl font-bold text-primary-600">L</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white">
            Local Service Finder
          </h2>
          <p className="mt-4 text-lg text-primary-100">
            Connect with trusted local service providers in Ghana. Quality
            services at your fingertips.
          </p>
          <div className="mt-8 flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3 rounded-lg bg-white/10 p-4">
              <span className="text-2xl">✓</span>
              <div>
                <h3 className="font-semibold text-white">Verified Providers</h3>
                <p className="text-sm text-primary-200">
                  All providers are background checked
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-white/10 p-4">
              <span className="text-2xl">✓</span>
              <div>
                <h3 className="font-semibold text-white">Easy Booking</h3>
                <p className="text-sm text-primary-200">
                  Book services in just a few clicks
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-white/10 p-4">
              <span className="text-2xl">✓</span>
              <div>
                <h3 className="font-semibold text-white">Secure Payments</h3>
                <p className="text-sm text-primary-200">
                  Safe and transparent transactions
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-700" />
        <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-primary-400 opacity-20" />
        <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-primary-400 opacity-20" />
      </div>
    </div>
  );
}
