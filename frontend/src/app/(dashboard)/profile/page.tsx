"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Mail, Phone, MapPin, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/hooks";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    try {
      // API call would go here
      console.log("Saving profile:", data);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Profile</h1>
        <p className="mt-1 text-secondary-600">
          Manage your personal information
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            {/* Avatar */}
            <div className="relative">
              <Avatar
                size="2xl"
                src={user?.profileImage}
                name={user?.name}
              />
              <button className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-colors hover:bg-primary-700">
                <Camera className="h-5 w-5" />
              </button>
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl font-bold text-secondary-900">
                {user?.name}
              </h2>
              <p className="text-secondary-500">
                {user?.role === "PROVIDER" ? "Service Provider" : "Customer"}
              </p>
              <p className="mt-1 text-sm text-secondary-400">
                Member since {new Date(user?.createdAt || "").toLocaleDateString()}
              </p>
            </div>

            {/* Edit Button */}
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <Input
                label="Full Name"
                placeholder="Your full name"
                disabled={!isEditing}
                error={errors.name?.message}
                {...register("name")}
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="your@email.com"
                disabled={!isEditing}
                leftIcon={<Mail className="h-5 w-5" />}
                error={errors.email?.message}
                {...register("email")}
              />
              <Input
                label="Phone Number"
                type="tel"
                placeholder="+233 XX XXX XXXX"
                disabled={!isEditing}
                leftIcon={<Phone className="h-5 w-5" />}
                error={errors.phone?.message}
                {...register("phone")}
              />
            </div>

            {isEditing && (
              <div className="flex gap-3">
                <Button type="submit" isLoading={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-secondary-200 p-4">
            <div>
              <h3 className="font-medium text-secondary-900">Email Verified</h3>
              <p className="text-sm text-secondary-500">
                {user?.emailVerifiedAt
                  ? "Your email has been verified"
                  : "Please verify your email address"}
              </p>
            </div>
            {!user?.emailVerifiedAt && (
              <Button variant="outline" size="sm">
                Verify Email
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-secondary-200 p-4">
            <div>
              <h3 className="font-medium text-secondary-900">Change Password</h3>
              <p className="text-sm text-secondary-500">
                Update your account password
              </p>
            </div>
            <Button variant="outline" size="sm">
              Change
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-error-200 bg-error-50 p-4">
            <div>
              <h3 className="font-medium text-error-700">Delete Account</h3>
              <p className="text-sm text-error-600">
                Permanently delete your account and all data
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
