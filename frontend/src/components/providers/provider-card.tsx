import Link from "next/link";
import { Star, MapPin, CheckCircle, Zap, Phone, Clock } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Provider } from "@/types";
import { cn, formatCurrency, getInitials } from "@/lib/utils";

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
            className="absolute left-3 top-3 z-10 gap-1 px-3 py-1 shadow-lg"
          >
            <Zap className="h-3 w-3" />
            FEATURED
          </Badge>
        )}

        <div className="flex flex-col gap-5 p-5 md:flex-row">
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
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-gray-900">
                  {provider.user.name}
                </h3>
                <p className="text-sm font-medium capitalize text-gray-600">
                  {primaryCategory?.name ?? "Service Professional"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-3 py-1">
                <Star className="h-4 w-4 fill-green-600 text-green-600" />
                <span className="text-sm font-bold text-green-700">
                  {Number(provider.rating).toFixed(1)}
                </span>
              </div>
            </div>

            {provider.specialties && provider.specialties.length > 0 && (
              <p className="mt-2 line-clamp-1 text-sm text-gray-600">
                {provider.specialties.slice(0, 3).join(" • ")}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary-500" />
                <span>{provider.location}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary-500" />
                <span>{provider.yearsExperience}+ years</span>
              </div>
              <span className="text-gray-400">·</span>
              <span>{provider.reviewCount} reviews</span>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(Number(provider.hourlyRate))}
                <span className="ml-1 text-sm font-normal text-gray-500">
                  /hr
                </span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" aria-label="Call">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button asChild>
                  <Link href={`/providers/${provider.id}`}>View &amp; Book</Link>
                </Button>
              </div>
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
          className="absolute left-3 top-3 z-10 gap-1 px-3 py-1 shadow-lg"
        >
          <Zap className="h-3 w-3" />
          FEATURED
        </Badge>
      )}

      <div className="bg-linear-to-br from-primary-50 via-white to-amber-50 p-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar
              className="h-16 w-16 rounded-2xl border-2 border-white shadow-md"
              size="xl"
            >
              <AvatarImage
                src={provider.user.profileImage}
                alt={provider.user.name}
              />
              <AvatarFallback className="rounded-2xl text-xl font-bold">
                {getInitials(provider.user.name)}
              </AvatarFallback>
            </Avatar>
            {verified && (
              <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 shadow-md">
                <CheckCircle className="h-5 w-5 fill-blue-500 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-gray-900">
              {provider.user.name}
            </h3>
            <p className="truncate text-sm font-medium text-gray-600">
              {primaryCategory?.name ?? "Service Professional"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6 pt-2">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5">
            <Star className="h-3.5 w-3.5 fill-green-600 text-green-600" />
            <span className="text-xs font-bold text-green-700">
              {Number(provider.rating).toFixed(1)}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {provider.reviewCount} reviews
          </span>
        </div>

        <p className="mb-4 line-clamp-2 text-sm text-gray-600">
          {provider.bio ||
            provider.specialties?.slice(0, 3).join(" • ") ||
            "Professional service provider."}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(Number(provider.hourlyRate))}
              <span className="text-xs font-normal text-gray-500">/hr</span>
            </p>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="h-3 w-3" />
              {provider.location}
            </div>
          </div>
          <Button size="sm" asChild>
            <Link href={`/providers/${provider.id}`}>View</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
