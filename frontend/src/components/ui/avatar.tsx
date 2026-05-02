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
}

function Avatar({
  className,
  size,
  src,
  alt,
  name,
  ...props
}: AvatarProps) {
  const initials = name ? getInitials(name) : "?";

  return (
    <div className={cn(avatarVariants({ size }), className)} {...props}>
      {src ? (
        <Image
          src={src}
          alt={alt || name || "Avatar"}
          fill
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-primary-100 font-medium text-primary-700">
          {initials}
        </div>
      )}
    </div>
  );
}

export { Avatar, avatarVariants };
