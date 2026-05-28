"use client";

import * as React from "react";
import Image from "next/image";
import { cn, getInitials } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-2xs",
        sm: "h-8 w-8 text-xs",
        default: "h-10 w-10 text-sm",
        lg: "h-12 w-12 text-base",
        xl: "h-16 w-16 text-lg",
        "2xl": "h-20 w-20 text-xl",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  src?: string | null;
  alt?: string;
  name?: string;
  /** next/image `sizes` hint. Override for large avatars (e.g. profile
   *  headers) so the browser requests a high-res source instead of the
   *  list-thumbnail default. */
  sizes?: string;
}

function Avatar({
  className,
  size,
  src,
  alt,
  name,
  sizes = "(max-width: 768px) 64px, 96px",
  children,
  ...props
}: AvatarProps) {
  const initials = name ? getInitials(name) : null;

  return (
    <div className={cn(avatarVariants({ size }), className)} {...props}>
      {children ? (
        children
      ) : src ? (
        <Image
          src={src}
          alt={alt || name || "Avatar"}
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-primary-100 font-semibold text-primary-700">
          {initials ?? "?"}
        </div>
      )}
    </div>
  );
}

export interface AvatarImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
}

function AvatarImage({ className, src, alt = "" }: AvatarImageProps) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 64px, 96px"
      className={cn("object-cover z-10", className)}
    />
  );
}

function AvatarFallback({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-0 flex h-full w-full items-center justify-center bg-primary-100 font-semibold text-primary-700",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback, avatarVariants };
