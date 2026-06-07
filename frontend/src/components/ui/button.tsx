import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary-500 text-white shadow-lg hover:bg-primary-600 active:bg-primary-700",
        secondary:
          "bg-secondary-100 text-secondary-900 hover:bg-secondary-200 active:bg-secondary-300",
        outline:
          "border-2 border-gray-200 bg-white text-gray-700 hover:border-primary-500 hover:text-primary-600",
        ghost:
          "text-gray-700 hover:bg-gray-50 hover:text-primary-600",
        destructive:
          "bg-error-500 text-white shadow-md hover:bg-error-600 active:bg-error-700",
        link: "text-primary-600 underline-offset-4 hover:underline shadow-none",
      },
      size: {
        sm: "h-11 px-4 text-sm rounded-lg",
        default: "h-11 px-4",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-lg",
        icon: "h-11 w-11 rounded-lg",
        "icon-sm": "h-11 w-11 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading,
      leftIcon,
      rightIcon,
      asChild = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
      return React.cloneElement(child, {
        className: cn(classes, child.props.className),
        children: (
          <>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : leftIcon ? (
              leftIcon
            ) : null}
            {child.props.children}
            {!isLoading && rightIcon}
          </>
        ),
      });
    }

    return (
      <button
        className={classes}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : leftIcon ? (
          leftIcon
        ) : null}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
