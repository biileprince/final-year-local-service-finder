"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks";

export default function LogoutPage() {
  const router = useRouter();
  const { logout, isAuthenticated } = useAuth();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout();
      } catch (error) {
        console.error("Logout error:", error);
      } finally {
        router.push("/login");
      }
    };

    if (isAuthenticated) {
      performLogout();
    } else {
      router.push("/login");
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-secondary-600">Signing you out...</p>
      </div>
    </div>
  );
}
