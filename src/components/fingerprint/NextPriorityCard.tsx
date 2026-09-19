"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { cn, cubicBezier } from "@/design/utils";
import { tokens } from "@/design/tokens";

const OUT = cubicBezier(tokens.motion.easings.out);

export interface NextPriorityCardProps {
  topic: string;
  reason: string;
  disabled?: boolean;
  onContinue: () => void;
  className?: string;
}

export function NextPriorityCard({
  topic,
  reason,
  disabled,
  onContinue,
  className,
}: NextPriorityCardProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      aria-label={`Next priority: ${topic}`}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{
        duration: tokens.motion.durations.standard / 1000,
        ease: OUT,
      }}
      className={cn(
        "rounded-md bg-surface p-lg shadow-card transition-shadow duration-micro ease-out hover:shadow-elevated",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-md">
        <h3 className="font-heading text-h3 font-semibold text-textPrimary">
          {topic}
        </h3>
        <Button size="sm" onClick={onContinue} disabled={disabled}>
          Continue
        </Button>
      </div>
      <p title={reason} className="mt-xs truncate text-small text-textMuted">
        {reason}
      </p>
    </motion.section>
  );
}
