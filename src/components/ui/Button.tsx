import { cn, FOCUS_RING } from "@/design/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-surface hover:shadow-card active:shadow-subtle",
  secondary: "bg-secondary text-surface hover:shadow-card active:shadow-subtle",
  ghost: "bg-transparent text-textPrimary hover:bg-surfaceMuted",
  danger: "bg-error text-surface hover:shadow-card active:shadow-subtle",
};

// All sizes keep a 48px (xxxl) minimum height — exceeds the 44px tap floor.
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-xxxl px-md text-small",
  md: "min-h-xxxl px-lg text-body",
  lg: "min-h-xxxl px-xl text-body font-medium",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-sm rounded-md font-medium transition duration-micro ease-out active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        disabled && "cursor-not-allowed opacity-50 active:scale-100",
        FOCUS_RING,
        className,
      )}
      {...props}
    />
  );
}
