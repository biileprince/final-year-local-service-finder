"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "info";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (input: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2, 11);
      const duration = input.duration ?? 4000;
      setToasts((prev) => [...prev, { ...input, id }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

const variantStyles: Record<
  ToastVariant,
  { wrapper: string; icon: React.ReactNode }
> = {
  default: {
    wrapper: "border-gray-200 bg-white text-gray-900",
    icon: <Info className="h-5 w-5 text-gray-500" />,
  },
  success: {
    wrapper: "border-green-200 bg-white text-gray-900",
    icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
  },
  error: {
    wrapper: "border-red-200 bg-white text-gray-900",
    icon: <AlertCircle className="h-5 w-5 text-red-600" />,
  },
  info: {
    wrapper: "border-primary-200 bg-white text-gray-900",
    icon: <Info className="h-5 w-5 text-primary-600" />,
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const styles = variantStyles[toast.variant ?? "default"];
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border-2 p-4 shadow-xl slide-in-from-bottom",
        styles.wrapper
      )}
    >
      <div className="mt-0.5 shrink-0">{styles.icon}</div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-bold leading-tight">{toast.title}</p>
        )}
        {toast.description && (
          <p
            className={cn(
              "text-sm text-gray-600",
              toast.title && "mt-1"
            )}
          >
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
