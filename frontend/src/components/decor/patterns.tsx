import { cn } from "@/lib/utils";

export function GridPattern({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const stroke =
    variant === "dark" ? "rgba(255,255,255,0.09)" : "rgba(17,24,39,0.06)";
  const strokeSoft =
    variant === "dark" ? "rgba(255,255,255,0.04)" : "rgba(17,24,39,0.04)";
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full",
        className,
      )}
    >
      <defs>
        <pattern
          id="weave-pattern"
          width="48"
          height="48"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M -12 12 L 12 -12 M 0 48 L 48 0 M 36 60 L 60 36"
            fill="none"
            stroke={stroke}
            strokeWidth="1"
          />
          <path
            d="M -12 36 L 36 -12 M 12 60 L 60 12"
            fill="none"
            stroke={strokeSoft}
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#weave-pattern)" />
    </svg>
  );
}

export function DotPattern({
  className,
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  const fill =
    variant === "dark" ? "rgba(255,255,255,0.1)" : "rgba(17,24,39,0.08)";
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full",
        className,
      )}
    >
      <defs>
        <pattern
          id="dot-pattern"
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="3" cy="4" r="1.2" fill={fill} />
          <circle cx="14" cy="14" r="1.2" fill={fill} />
          <circle cx="24" cy="8" r="1.2" fill={fill} />
          <circle cx="8" cy="22" r="1.2" fill={fill} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-pattern)" />
    </svg>
  );
}

export function GrainOverlay({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.85 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

interface OrbProps {
  className?: string;
  color?: string;
  size?: string;
}

export function GradientOrb({
  className,
  color = "from-primary-500 to-primary-700",
  size = "h-[28rem] w-[28rem]",
}: OrbProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute rounded-full bg-linear-to-br blur-3xl opacity-30",
        color,
        size,
        className,
      )}
    />
  );
}
