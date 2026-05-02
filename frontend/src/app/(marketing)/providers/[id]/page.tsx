"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Star,
  MapPin,
  Clock,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  CheckCircle,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { providersService, reviewsService } from "@/lib/api";
import type { Provider, Review } from "@/types";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/hooks";

export default function ProviderDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "about" | "reviews" | "availability"
  >("about");

  useEffect(() => {
    if (params.id) {
      loadProvider(params.id as string);
    }
  }, [params.id]);

  const loadProvider = async (id: string) => {
    setIsLoading(true);
    try {
      const [providerData, reviewsData] = await Promise.all([
        providersService.getById(id),
        reviewsService.getByProvider(id),
      ]);
      setProvider(providerData);
      setReviews(reviewsData.data || []);
    } catch (error) {
      console.error("Failed to load provider:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-secondary-900">
          Provider not found
        </h1>
        <p className="mt-2 text-secondary-600">
          The provider you are looking for does not exist.
        </p>
        <Button asChild className="mt-4">
          <Link href="/search">Back to Search</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50">
      <div className="bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/search"
            className="mb-4 inline-flex items-center text-sm text-secondary-600 hover:text-secondary-900"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to search
          </Link>

          <div className="flex flex-col gap-6 sm:flex-row">
            <Avatar
              size="2xl"
              src={provider.user.profileImage}
              name={provider.user.name}
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-secondary-900">
                  {provider.user.name}
                </h1>
                {provider.verificationStatus === "VERIFIED" && (
                  <Badge variant="success">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {provider.categories.map((pc) => (
                  <Badge key={pc.id} variant="secondary">
                    {pc.category.name}
                  </Badge>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-secondary-600">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-warning-500 text-warning-500" />
                  <span className="font-semibold text-secondary-900">
                    {Number(provider.rating).toFixed(1)}
                  </span>
                  <span>({provider.reviewCount} reviews)</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{provider.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{provider.yearsExperience} years experience</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div>
                  <span className="text-2xl font-bold text-primary-600">
                    {formatCurrency(Number(provider.hourlyRate))}
                  </span>
                  <span className="text-secondary-500">/hour</span>
                </div>
                {user?.role === "CUSTOMER" && (
                  <Button asChild>
                    <Link href={`/book/${provider.id}`}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Book Now
                    </Link>
                  </Button>
                )}
                <Button variant="outline">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Message
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8">
            {(["about", "reviews", "availability"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-secondary-600 hover:text-secondary-900"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "about" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-secondary-700">
                  {provider.bio || "No description available."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {provider.user.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-secondary-400" />
                    <span className="text-secondary-700">
                      {provider.user.email}
                    </span>
                  </div>
                )}
                {provider.user.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-secondary-400" />
                    <span className="text-secondary-700">
                      {provider.user.phone}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-secondary-400" />
                  <span className="text-secondary-700">
                    {provider.location}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Star className="mx-auto h-12 w-12 text-secondary-300" />
                  <p className="mt-4 text-secondary-600">No reviews yet</p>
                </CardContent>
              </Card>
            ) : (
              reviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar
                        src={review.customer?.profileImage}
                        name={review.customer?.name}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-secondary-900">
                            {review.customer?.name}
                          </h4>
                          <span className="text-sm text-secondary-500">
                            {formatRelativeTime(review.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
                                  ? "fill-warning-500 text-warning-500"
                                  : "fill-secondary-200 text-secondary-200"
                              }`}
                            />
                          ))}
                        </div>
                        {review.comment && (
                          <p className="mt-3 text-secondary-700">
                            {review.comment}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === "availability" && (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-secondary-300" />
              <p className="mt-4 text-secondary-600">
                View availability when booking a service
              </p>
              {user?.role === "CUSTOMER" && (
                <Button asChild className="mt-4">
                  <Link href={`/book/${provider.id}`}>Check Availability</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
