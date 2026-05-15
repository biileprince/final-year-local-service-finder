"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Camera,
  Mail,
  Phone,
  Save,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/hooks";
import { authService, filesService } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Schemas ────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// ─── OTP Modal ───────────────────────────────────────────────────────────────

function OtpModal({
  phone,
  onClose,
  onVerified,
}: {
  phone: string;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setSending(true);
    setError(null);
    try {
      await authService.sendOtp(phone);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await authService.verifyOtp(phone, code);
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-gray-900">Verify phone number</h2>
        <p className="mt-1 text-sm text-gray-600">
          We&apos;ll send a 6-digit code to <strong>{phone}</strong>.
        </p>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!sent ? (
          <Button
            className="mt-4 w-full"
            isLoading={sending}
            onClick={sendCode}
          >
            Send verification code
          </Button>
        ) : (
          <div className="mt-4 space-y-3">
            <Input
              label="Enter 6-digit code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <Button className="w-full" isLoading={verifying} onClick={verify}>
              Verify
            </Button>
            <button
              type="button"
              className="w-full text-sm text-gray-500 hover:text-gray-700"
              onClick={sendCode}
            >
              Resend code
            </button>
          </div>
        )}

        <button
          type="button"
          className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Change Password Modal ───────────────────────────────────────────────────

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setApiError(null);
    try {
      await authService.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setSuccess(true);
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "Failed to change password",
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        {success ? (
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-3 text-lg font-bold text-gray-900">
              Password changed
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Your password has been updated successfully.
            </p>
            <Button className="mt-4 w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-900">Change password</h2>
            <p className="mt-1 text-sm text-gray-600">
              You&apos;ll need your current password to confirm this change.
            </p>

            {apiError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
              <Input
                label="Current password"
                type={showCurrent ? "text" : "password"}
                error={errors.currentPassword?.message}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                  >
                    {showCurrent ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                }
                {...register("currentPassword")}
              />
              <Input
                label="New password"
                type={showNew ? "text" : "password"}
                error={errors.newPassword?.message}
                rightIcon={
                  <button type="button" onClick={() => setShowNew((v) => !v)}>
                    {showNew ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                }
                {...register("newPassword")}
              />
              <Input
                label="Confirm new password"
                type="password"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  isLoading={isSubmitting}
                >
                  Update
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, setUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showOtp, setShowOtp] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await filesService.upload(file, "AVATAR");
      const updated = await authService.updateUser({ profileImage: uploaded.url });
      setUser(updated);
    } catch {
      // silently fail – avatar is non-critical
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? "",
      phone: user?.phone ?? "",
    },
  });

  const watchedPhone = watch("phone");

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await authService.updateUser({
        name: data.name,
        phone: data.phone || undefined,
      });
      setUser(updated);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save profile",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    reset({ name: user?.name ?? "", phone: user?.phone ?? "" });
    setIsEditing(false);
    setSaveError(null);
  };


  const handlePhoneVerified = () => {
    setPhoneVerified(true);
    setShowOtp(false);
  };

  return (
    <>
      {showOtp && watchedPhone && (
        <OtpModal
          phone={watchedPhone}
          onClose={() => setShowOtp(false)}
          onVerified={handlePhoneVerified}
        />
      )}
      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Profile</h1>
          <p className="mt-1 text-secondary-600">
            Manage your personal information
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            <CheckCircle className="h-4 w-4" />
            Profile saved successfully
          </div>
        )}

        {/* Avatar card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="relative">
                <Avatar size="2xl" src={user?.profileImage} name={user?.name} />
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-colors hover:bg-primary-700 disabled:opacity-50"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-xl font-bold text-secondary-900">
                  {user?.name}
                </h2>
                <p className="text-secondary-500">
                  {user?.role === "PROVIDER" ? "Service Provider" : "Customer"}
                </p>
                <p className="mt-1 text-sm text-secondary-400">
                  Member since{" "}
                  {new Date(user?.createdAt ?? "").toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              {!isEditing && (
                <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profile form */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {saveError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {saveError}
                </div>
              )}
              <div className="grid gap-6 sm:grid-cols-2">
                <Input
                  label="Full Name"
                  placeholder="Your full name"
                  disabled={!isEditing}
                  error={errors.name?.message}
                  {...register("name")}
                />
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Email Address
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2.5">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="flex-1 text-sm text-gray-600">
                      {user?.email}
                    </span>
                    <span className="text-xs text-gray-400">
                      Contact support to change
                    </span>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Input
                        label="Phone Number"
                        type="tel"
                        placeholder="+233 XX XXX XXXX"
                        disabled={!isEditing}
                        leftIcon={<Phone className="h-4 w-4" />}
                        error={errors.phone?.message}
                        {...register("phone")}
                      />
                    </div>
                    {isEditing && watchedPhone && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mb-0.5 shrink-0"
                        onClick={() => setShowOtp(true)}
                        leftIcon={<Shield className="h-4 w-4" />}
                      >
                        {phoneVerified ? "Verified" : "Verify"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="flex gap-3">
                  <Button type="submit" isLoading={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Account settings */}
        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email verification */}
            <div className="flex items-center justify-between rounded-lg border border-secondary-200 p-4">
              <div>
                <h3 className="font-medium text-secondary-900">
                  Email Verified
                </h3>
                <p className="text-sm text-secondary-500">
                  {user?.emailVerifiedAt
                    ? `Verified on ${new Date(user.emailVerifiedAt).toLocaleDateString()}`
                    : "Please verify your email address"}
                </p>
              </div>
              {user?.emailVerifiedAt ? (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Verified
                </span>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href="/verify-email">Verify now</Link>
                </Button>
              )}
            </div>

            {/* Change password */}
            <div className="flex items-center justify-between rounded-lg border border-secondary-200 p-4">
              <div>
                <h3 className="font-medium text-secondary-900">
                  Change Password
                </h3>
                <p className="text-sm text-secondary-500">
                  Update your account password
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChangePassword(true)}
              >
                Change
              </Button>
            </div>

            {/* Delete account */}
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
              <div>
                <h3 className="font-medium text-red-700">Delete Account</h3>
                <p className="text-sm text-red-600">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  alert(
                    "To delete your account, please contact support at support@localservicefinder.com",
                  )
                }
              >
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
