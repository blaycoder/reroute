import algebra from "../../public/fallback/intervention-algebra.json";
import simultaneous from "../../public/fallback/intervention-simultaneous.json";
import indices from "../../public/fallback/intervention-indices.json";
import geometry from "../../public/fallback/intervention-geometry.json";

// Pre-written intervention content, one file per concept. These are also the
// fallback when the LLM cannot personalise the explanation: they hold text and
// question ids only — never answers — so they are safe to serve as static files.
// The questions themselves live in the question bank.

export interface InterventionTemplate {
  topic: string;
  /** Human phrase for the headline: "Let's fix {conceptLabel}." */
  conceptLabel: string;
  explanation: string;
  workedExample: string;
  guidedQuestion: string;
  guidedQuestionId: string;
  practiceQuestionIds: string[];
  reassessmentQuestionIds: string[];
}

const TEMPLATES: InterventionTemplate[] = [
  algebra,
  simultaneous,
  indices,
  geometry,
];

const BY_TOPIC = new Map(TEMPLATES.map((template) => [template.topic, template]));

/** The reassessment shows two questions; the third is held back for a retry. */
export const REASSESSMENT_QUESTION_COUNT = 2;

export function getInterventionTemplate(
  topic: string,
): InterventionTemplate | undefined {
  return BY_TOPIC.get(topic);
}

export function listInterventionTemplates(): InterventionTemplate[] {
  return TEMPLATES;
}
