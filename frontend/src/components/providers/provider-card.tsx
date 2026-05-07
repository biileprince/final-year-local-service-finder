import Link from "next/link";
import { Star, MapPin, CheckCircle, Zap, Phone, Clock } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Provider } from "@/types";
import { cn, getInitials } from "@/lib/utils";

interface ProviderCardProps {
  provider: Provider;
  variant?: "grid" | "row";
  className?: string;
}

export function ProviderCard({
  provider,
  variant = "grid",
  className,
}: ProviderCardProps) {
  const verified = provider.verificationStatus === "VERIFIED";
  const primaryCategory =
    provider.categories.find((c) => c.isPrimary)?.category ??
    provider.categories[0]?.category;

  if (variant === "row") {
    return (
      <Card
        className={cn(
          "group relative overflow-hidden border-2 border-transparent bg-white transition-all hover:-translate-y-1 hover:border-primary-200 hover:shadow-xl",
          className
        )}
      >
        {provider.featured && (
          <Badge
            variant="default"
            className="absolute left-4 top-4 z-10 gap-1 px-4 py-1.5 shadow-lg"
          >
            <Zap className="h-4 w-4" />
            FEATURED
          </Badge>
        )}

        <div className="flex flex-col gap-6 p-6 md:flex-row">
          <div className="relative shrink-0 self-center md:self-start">
            <Avatar
              className="h-24 w-24 rounded-2xl border-2 border-gray-100"
              size="2xl"
            >
              <AvatarImage
                src={provider.user.profileImage}
                alt={provider.user.name}
              />
              <AvatarFallback className="rounded-2xl text-2xl font-bold">
                {getInitials(provider.user.name)}
              </AvatarFallback>
            </Avatar>
            {verified && (
              <div className="absolute -bottom-1.5 -right-1.5 rounded-full bg-white p-0.5 shadow-md">
                <CheckCircle className="h-6 w-6 fill-blue-500 text-white" />
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-gray-900">
                  {provider.user.name}
                </h3>
                <p className="text-base font-medium capitalize text-primary-600">
                  {primaryCategory?.name ?? "Service Professional"}
                </p>
                {/* All categories */}
                {provider.categories.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {provider.categories.map((pc) => (
                      <span
                        key={pc.id}
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          pc.isPrimary
                            ? "bg-primary-100 text-primary-700"
                            : "bg-gray-100 text-gray-600",
                        )}
                      >
                        {pc.category.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-full bg-green-50 px-4 py-2">
                <Star className="h-5 w-5 fill-green-600 text-green-600" />
                <span className="text-base font-bold text-green-700">
                  {Number(provider.rating).toFixed(1)}
                </span>
              </div>
            </div>

            {/* Bio / About description */}
            {(provider.bio || provider.specialties?.length) && (
              <p className="mt-3 text-base leading-relaxed text-gray-600">
                {provider.bio ||
                  provider.specialties?.map((s) => s.specialty).join(" · ") ||
                  ""}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-base text-gray-600">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary-500" />
                <span>{provider.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary-500" />
                <span>{provider.yearsExperience}+ years</span>
              </div>
              <span className="text-gray-400">·</span>
              <span>{provider.reviewCount} reviews</span>
            </div>

            <div className="mt-6 flex items-end justify-end gap-4">
              <Button variant="outline" size="icon" aria-label="Call" title="Call">
                <Phone className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="border-primary-200 text-primary-700 hover:bg-primary-50 hover:text-primary-800" asChild>
                <Link href={`/providers/${provider.id}`}>View &amp; Book</Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "group relative flex flex-col overflow-hidden border-2 border-transparent bg-white transition-all hover:-translate-y-2 hover:border-primary-200 hover:shadow-2xl",
        className
      )}
    >
      {provider.featured && (
        <Badge
          variant="default"
          className="absolute left-4 top-4 z-10 gap-1 px-4 py-1.5 shadow-lg"
        >
          <Zap className="h-4 w-4" />
          FEATURED
        </Badge>
      )}

      <div className="bg-linear-to-br from-primary-50 via-white to-amber-50 p-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar
              className="h-20 w-20 rounded-2xl border-2 border-white shadow-md"
              size="2xl"
            >
              <AvatarImage
                src={provider.user.profileImage}
                alt={provider.user.name}
              />
              <AvatarFallback className="rounded-2xl text-2xl font-bold">
                {getInitials(provider.user.name)}
              </AvatarFallback>
            </Avatar>
            {verified && (
              <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 shadow-md">
                <CheckCircle className="h-6 w-6 fill-blue-500 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-bold text-gray-900">
              {provider.user.name}
            </h3>
            <p className="truncate text-base font-medium text-gray-600">
              {primaryCategory?.name ?? "Service Professional"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6 pt-4">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1">
            <Star className="h-4 w-4 fill-green-600 text-green-600" />
            <span className="text-sm font-bold text-green-700">
              {Number(provider.rating).toFixed(1)}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {provider.reviewCount} reviews
          </span>
        </div>

        <p className="mb-4 line-clamp-2 text-base text-gray-600">
          {provider.bio ||
            provider.specialties?.slice(0, 3).map((s) => s.specialty).join(" • ") ||
            "Professional service provider."}
        </p>

        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <MapPin className="h-4 w-4 shrink-0" />
          {provider.location}
        </div>

        <div className="mt-auto border-t border-gray-100 pt-4">
          <Button size="lg" className="w-full" asChild>
            <Link href={`/providers/${provider.id}`}>
              View &amp; Book
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
