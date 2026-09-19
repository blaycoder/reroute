import Link from "next/link";
import { cn, FOCUS_RING } from "@/design/utils";

export default function MarketingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-xl">
      <h1 className="font-heading text-h1 font-bold tracking-tight text-textPrimary">
        Reroute
      </h1>
      <p className="mt-md max-w-md text-center text-body leading-relaxed text-textMuted">
        Diagnosis-first AI learning for JAMB Mathematics. Placeholder — landing
        page content comes with the design pass.
      </p>
      {/* A real link, not <Button>: Button renders a <button>, and navigation
          should stay a working anchor. Classes mirror Button's primary/lg style. */}
      <Link
        href="/onboarding"
        className={cn(
          "mt-xl inline-flex min-h-xxxl w-full max-w-md items-center justify-center rounded-md bg-primary px-xl text-body font-medium text-surface transition duration-micro ease-out hover:shadow-card active:scale-[0.98] active:shadow-subtle",
          FOCUS_RING,
        )}
      >
        Start onboarding
      </Link>
    </main>
  );
}
