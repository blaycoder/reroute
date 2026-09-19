"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api-client";
import { FingerprintBar } from "@/components/fingerprint/FingerprintBar";
import { PriorityCallout } from "@/components/fingerprint/PriorityCallout";
import { cn, FOCUS_RING } from "@/design/utils";
import { tokens } from "@/design/tokens";
import type {
  DiagnosticStartResponse,
  FingerprintResponse,
  LearnerProfileSummary,
} from "@/types/api";
import type { ErrorType } from "@/types/learner-state";

const DIAGNOSTIC_KEY = "reroute.diagnostic";
const FINGERPRINT_KEY = "reroute.fingerprint";
const INTERVENTION_KEY = "reroute.intervention";

interface StoredComplete {
  learnerProfile: LearnerProfileSummary;
  readinessIndex: number;
  priorityTopic: string;
}

const ERROR_TYPE_LINES: Record<ErrorType, string> = {
  conceptual: "Concept gaps are behind most wrong answers here.",
  procedural: "The method slips under pressure.",
  application: "Knows the idea, struggles to apply it.",
  careless: "Rushing is costing marks.",
};

export default function FingerprintPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [phase, setPhase] = useState<"booting" | "ready">("booting");
  const [data, setData] = useState<FingerprintResponse | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    const diagnosticRaw = sessionStorage.getItem(DIAGNOSTIC_KEY);
    const fingerprintRaw = sessionStorage.getItem(FINGERPRINT_KEY);
    const storedStudentId = diagnosticRaw
      ? ((JSON.parse(diagnosticRaw) as DiagnosticStartResponse).studentId ?? null)
      : null;

    if (fingerprintRaw) {
      const stored = JSON.parse(fingerprintRaw) as StoredComplete;
      setData({
        overall: stored.learnerProfile.overall,
        byTopic: stored.learnerProfile.byTopic,
        readinessIndex: stored.readinessIndex,
        profileConfidence: stored.learnerProfile.profileConfidence,
        priorityTopic: stored.priorityTopic,
        interventionHistory: stored.learnerProfile.interventionHistory,
      });
      setStudentId(storedStudentId);
      setPhase("ready");
      return;
    }

    if (!storedStudentId) {
      router.replace("/onboarding");
      return;
    }

    (async () => {
      const fetchedFingerprint = await apiFetch<FingerprintResponse>(
        `/api/learner/${storedStudentId}/fingerprint`,
      );
      setData(fetchedFingerprint);
      setStudentId(storedStudentId);
      setPhase("ready");
    })().catch(() => {
      showToast({
        variant: "error",
        message: "We couldn't load your fingerprint yet. Complete a diagnostic first.",
      });
      router.replace("/onboarding");
    });
  }, [router, showToast]);

  const confidenceWord = !data
    ? "growing"
    : data.profileConfidence < 0.55
      ? "growing"
      : data.profileConfidence < 0.8
        ? "strengthening"
        : "solid";

  const accuracy = data ? Math.round(data.overall.accuracy * 100) : 0;
  const speedScore = data ? Math.round(data.overall.speedScore ?? 0) : 0;
  const calibration = data
    ? Math.round(100 * (1 - Math.min(1, Math.abs(data.overall.confidenceCalibration))))
    : 0;
  const readiness = data?.readinessIndex ?? 0;

  const priorityTopic = data?.priorityTopic ?? null;
  const priorityProfile = priorityTopic ? data?.byTopic[priorityTopic] : undefined;
  const priorityScore = Math.min(1, priorityProfile?.priorityScore ?? 0);
  const otherTopics = data
    ? Object.entries(data.byTopic).filter(([topic]) => topic !== priorityTopic)
    : [];

  const handleFix = useCallback(() => {
    if (!data || !priorityTopic || !studentId) return;
    sessionStorage.setItem(
      INTERVENTION_KEY,
      JSON.stringify({
        studentId,
        topic: priorityTopic,
        errorType: priorityProfile?.errorType ?? "conceptual",
        confidence: priorityProfile?.confidence ?? "medium",
      }),
    );
    router.push("/intervention");
  }, [data, priorityTopic, priorityProfile, studentId, router]);

  if (phase === "booting") {
    return (
      <main
        aria-busy="true"
        className="flex min-h-screen flex-col justify-center bg-background px-lg"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-lg">
          <Skeleton variant="line" className="w-2/3" />
          <Skeleton variant="card" />
          <Skeleton variant="line" />
          <Skeleton variant="line" />
        </div>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="flex min-h-screen flex-col bg-background px-lg py-xl">
      <div className="mx-auto flex w-full max-w-md flex-col">
        <p className="font-heading text-h3 font-bold text-textPrimary">
          Reroute<span className="text-primary">.</span>
        </p>

        <h1 className="mt-xl font-heading text-h1 font-semibold leading-tight text-textPrimary">
          Your learning fingerprint
        </h1>
        <p className="mt-sm text-body leading-relaxed text-textMuted">
          This is how you think — not just what you scored.
        </p>

        <p className="mt-lg inline-flex w-fit items-center rounded-pill bg-surfaceMuted px-md text-micro leading-relaxed text-textMuted">
          Profile confidence: {confidenceWord}
        </p>

        <Card className="mt-xl">
          <div className="flex items-center justify-between gap-sm">
            <span className="text-small text-textMuted">Readiness Index</span>
            <button
              type="button"
              onClick={() => setTooltipOpen((open) => !open)}
              aria-expanded={tooltipOpen}
              aria-describedby={tooltipOpen ? "readiness-tooltip" : undefined}
              aria-label="What is the Readiness Index?"
              className={cn(
                "flex h-xxxl w-xxxl items-center justify-center rounded-full text-textMuted transition duration-micro ease-out hover:bg-surfaceMuted",
                FOCUS_RING,
              )}
            >
              <HelpCircle className="h-lg w-lg" aria-hidden />
            </button>
          </div>
          <p className="font-heading text-h1 font-semibold text-textPrimary">
            {readiness}
            <span className="text-h3 text-textMuted">/100</span>
          </p>
          {tooltipOpen && (
            <p
              id="readiness-tooltip"
              className="mt-sm text-small leading-relaxed text-textMuted"
            >
              Based on demonstrated accuracy, consistency, and confidence
              calibration — not a predicted JAMB score.
            </p>
          )}
        </Card>

        <div className="mt-xl flex flex-col gap-lg">
          <div className="flex flex-col gap-xs">
            <FingerprintBar
              label="Accuracy"
              value={accuracy}
              delayMs={0}
            />
            <p className="text-small text-textMuted">How often you get it right.</p>
          </div>
          <div className="flex flex-col gap-xs">
            <FingerprintBar
              label="Speed"
              value={speedScore}
              delayMs={tokens.motion.durations.micro}
            />
            <p className="text-small text-textMuted">
              How quickly you solve, compared to the expected time.
            </p>
          </div>
          <div className="flex flex-col gap-xs">
            <FingerprintBar
              label="Confidence Calibration"
              value={calibration}
              delayMs={tokens.motion.durations.micro * 2}
            />
            <p className="text-small text-textMuted">Whether you know what you know.</p>
          </div>
        </div>

        {priorityTopic && (
          <PriorityCallout
            className="mt-xl"
            topic={priorityTopic}
            misconception={
              priorityProfile?.errorType
                ? ERROR_TYPE_LINES[priorityProfile.errorType]
                : "This topic is holding your readiness back."
            }
            reason="This is where you're losing the most marks right now."
            impact={priorityScore}
            actionLabel="Fix this first"
            onAction={handleFix}
          />
        )}

        {otherTopics.length > 0 && (
          <details className="group mt-xl rounded-md bg-surface shadow-card">
            <summary
              className={cn(
                "flex min-h-xxxl list-none items-center justify-between px-lg text-small font-semibold text-textPrimary [&::-webkit-details-marker]:hidden",
                FOCUS_RING,
              )}
            >
              Other topics ({otherTopics.length})
              <ChevronDown
                className="h-lg w-lg text-textMuted transition-transform duration-micro ease-out group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="flex flex-col gap-lg px-lg pb-lg">
              {otherTopics.map(([topicName, profile]) => (
                <FingerprintBar
                  key={topicName}
                  label={topicName}
                  value={Math.round(profile.accuracy * 100)}
                />
              ))}
            </div>
          </details>
        )}

        <Button
          variant="ghost"
          fullWidth
          className="mt-xl"
          onClick={() => router.push("/")}
        >
          Back to start
        </Button>
      </div>
    </main>
  );
}
