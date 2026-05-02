import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface SpinnerProps {
  size?: "sm" | "default" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  default: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Spinner({ size = "default", className }: SpinnerProps) {
  return (
    <Loader2
      className={cn(
        "animate-spin text-primary-600",
        sizeClasses[size],
        className
      )}
    />
  );
}

interface LoadingProps {
  text?: string;
  fullScreen?: boolean;
}

export function Loading({ text = "Loading...", fullScreen = false }: LoadingProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-secondary-500">{text}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return (
    <div className="flex min-h-[200px] items-center justify-center">
      {content}
    </div>
  );
}
