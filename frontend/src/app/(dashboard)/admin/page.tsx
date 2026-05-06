"use client";

import Link from "next/link";
import { ShieldCheck, Users, Calendar, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useRequireRole } from "@/hooks";

const TILES = [
  {
    href: "/admin/providers",
    title: "Provider verification queue",
    description: "Approve or reject providers waiting on verification.",
    icon: ShieldCheck,
  },
  {
    href: "/admin/users",
    title: "Users",
    description: "Search, suspend, or change roles.",
    icon: Users,
  },
  {
    href: "/admin/bookings",
    title: "Bookings overview",
    description: "Cross-platform booking activity and admin overrides.",
    icon: Calendar,
  },
  {
    href: "/analytics",
    title: "Analytics",
    description: "Platform-wide usage and growth metrics.",
    icon: BarChart3,
  },
];

export default function AdminHomePage() {
  const { isLoading, hasRole } = useRequireRole(["ADMIN"]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasRole) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Admin</h1>
        <p className="mt-1 text-secondary-600">
          Moderate providers, manage users, and oversee bookings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="block">
            <Card className="h-full transition-colors hover:border-primary-300 hover:bg-primary-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <tile.icon className="h-5 w-5 text-primary-600" />
                  {tile.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-secondary-600">{tile.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-xs text-secondary-500">
        Note: only the verification queue is currently wired up. The other
        sections will be built out in upcoming sessions.
      </p>
    </div>
  );
}
