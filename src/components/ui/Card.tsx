import { cn } from "@/design/utils";

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** Fills role="region" for screen-reader landmarks. */
  ariaLabel?: string;
}

export function Card({ ariaLabel, className, children, ...props }: CardProps) {
  return (
    <section
      aria-label={ariaLabel}
      role={ariaLabel ? "region" : undefined}
      className={cn("rounded-md bg-surface p-xl shadow-card", className)}
      {...props}
    >
      {children}
    </section>
  );
}
