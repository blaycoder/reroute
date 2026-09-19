"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { cn, cubicBezier } from "@/design/utils";
import { tokens } from "@/design/tokens";

export interface PriorityCalloutProps {
  topic: string;
  misconception: string;
  reason: string;
  /** 0–1, estimated impact on readiness. */
  impact: number;
  actionLabel?: string;
  onAction: () => void;
  className?: string;
}

const OUT = cubicBezier(tokens.motion.easings.out);
const IN_OUT = cubicBezier(tokens.motion.easings.inOut);

export function PriorityCallout({
  topic,
  misconception,
  reason,
  impact,
  actionLabel = "Fix this first.",
  onAction,
  className,
}: PriorityCalloutProps) {
  const reduceMotion = useReducedMotion();
  const seconds = tokens.motion.durations.hero / 1000;

  return (
    <motion.section
      aria-label="Biggest opportunity"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: tokens.spacing.xl }}
      animate={
        reduceMotion
          ? { opacity: 1 }
          : {
              opacity: 1,
              y: 0,
              boxShadow: [tokens.shadows.card, tokens.shadows.elevated, tokens.shadows.card],
            }
      }
      transition={{
        opacity: { duration: seconds, ease: OUT },
        y: { duration: seconds, ease: OUT },
        boxShadow: {
          delay: seconds,
          duration: seconds,
          ease: IN_OUT,
        },
      }}
      className={cn("rounded-md bg-surface p-xl", className)}
    >
      <span className="inline-flex items-center rounded-pill bg-accent px-sm py-1 text-micro font-semibold text-textPrimary">
        Biggest opportunity
      </span>
      <h2 className="mt-md font-heading text-h2 font-semibold text-textPrimary">
        {topic}
      </h2>
      <p className="mt-xs text-body text-textPrimary">{misconception}</p>
      <p className="mt-sm text-small leading-relaxed text-textMuted">{reason}</p>
      <div className="mt-lg flex items-center justify-between gap-md">
        <span className="rounded-pill bg-surfaceMuted px-sm py-1 text-micro font-semibold text-success">
          +{Math.round(impact * 100)} pts readiness
        </span>
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    </motion.section>
  );
}
