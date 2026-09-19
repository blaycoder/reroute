"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, X, AlertCircle } from "lucide-react";
import { cn, FOCUS_RING } from "@/design/utils";
import { tokens } from "@/design/tokens";

type ToastVariant = "success" | "error" | "info";

export interface ToastShowOptions {
  variant: ToastVariant;
  message: string;
  durationMs?: number;
}

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
  durationMs: number;
  exiting: boolean;
}

interface ToastContextValue {
  showToast: (options: ToastShowOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-l-4 border-l-success",
  error: "border-l-4 border-l-error",
  info: "border-l-4 border-l-primary",
};

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-lg w-lg text-success" aria-hidden />,
  error: <AlertCircle className="h-lg w-lg text-error" aria-hidden />,
  info: <Info className="h-lg w-lg text-primary" aria-hidden />,
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      className={cn(
        "flex items-center gap-md rounded-md bg-surface p-lg text-textPrimary shadow-elevated",
        VARIANT_STYLES[toast.variant],
        toast.exiting ? "animate-toast-out" : "animate-toast-in",
      )}
    >
      {ICONS[toast.variant]}
      <p className="flex-1 text-small">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className={cn(
          "flex h-xxxl w-xxxl items-center justify-center rounded-md text-textMuted transition duration-micro ease-out hover:bg-surfaceMuted",
          FOCUS_RING,
        )}
      >
        <X className="h-lg w-lg" aria-hidden />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) =>
      current.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, tokens.motion.durations.micro);
  }, []);

  const showToast = useCallback((options: ToastShowOptions) => {
    const id = nextId.current++;
    setToasts((current) => [
      ...current,
      {
        id,
        variant: options.variant,
        message: options.message,
        durationMs: options.durationMs ?? 3000,
        exiting: false,
      },
    ]);
  }, []);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed inset-x-lg bottom-lg z-50 flex flex-col gap-sm">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
