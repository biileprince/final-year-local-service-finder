"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "lsf_install_dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed (running standalone) → never show.
    if (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone
    ) {
      return;
    }
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-secondary-200 bg-white p-4 shadow-lg sm:left-auto sm:right-4 sm:mx-0">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-sm font-bold text-white">
        LSF
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-secondary-900">
          Install Local Service Finder
        </p>
        <p className="truncate text-xs text-secondary-500">
          Add it to your home screen for quick access.
        </p>
      </div>
      <button
        onClick={install}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
      >
        <Download className="h-4 w-4" />
        Install
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="shrink-0 rounded-lg p-1.5 text-secondary-400 hover:bg-secondary-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
