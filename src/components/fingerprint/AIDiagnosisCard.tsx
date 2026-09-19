import { Card } from "@/components/ui/Card";
import { MathText } from "@/components/ui/MathText";
import type { HeadlineDiagnosis } from "@/types/learner-state";

export interface AIDiagnosisCardProps {
  diagnosis: HeadlineDiagnosis;
  className?: string;
}

// The AI's read of the student's most telling wrong answer in the priority
// topic. When it disagreed with the question's pre-tagged misconception, a
// small label says so — the override is what makes the diagnosis personal.
export function AIDiagnosisCard({ diagnosis, className }: AIDiagnosisCardProps) {
  return (
    <Card className={className}>
      <h2 className="text-small font-semibold text-textPrimary">
        What the AI noticed
      </h2>
      <MathText
        text={diagnosis.diagnosis}
        className="mt-sm text-body leading-relaxed text-textPrimary"
      />
      <p className="mt-sm text-micro text-textMuted">{diagnosis.topic}</p>
      {diagnosis.overrodePrior && (
        <p className="mt-md inline-flex w-fit items-center rounded-pill bg-surfaceMuted px-md text-micro leading-relaxed text-secondary">
          AI overrode the static mapping
        </p>
      )}
    </Card>
  );
}
