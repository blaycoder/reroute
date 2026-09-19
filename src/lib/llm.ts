// Single LLM entry point so providers can be swapped without touching
// callers. OpenAI and Zhipu both speak the chat-completions shape.
//
// generateText NEVER throws and NEVER logs the key: it returns null on any
// failure (missing key, network error, non-200, timeout, empty body), and
// callers fall back to pre-cached content. With no keys configured every
// route runs fully offline — the demo cannot break on stage.

export interface LlmRequest {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmResponse {
  text: string;
  provider: "openai" | "zhipu";
}

const TIMEOUT_MS = 12_000;

interface ProviderConfig {
  name: "openai" | "zhipu";
  apiKey: string;
  url: string;
  model: string;
}

function resolveProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      url: "https://api.openai.com/v1/chat/completions",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    });
  }
  if (process.env.ZHIPU_API_KEY) {
    providers.push({
      name: "zhipu",
      apiKey: process.env.ZHIPU_API_KEY,
      url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      model: process.env.ZHIPU_MODEL ?? "glm-4-flash",
    });
  }
  return providers;
}

export async function generateText(
  request: LlmRequest,
): Promise<LlmResponse | null> {
  for (const provider of resolveProviders()) {
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          temperature: request.temperature ?? 0.3,
          max_tokens: request.maxTokens ?? 1024,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const text = data.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.trim().length > 0) {
        return { text, provider: provider.name };
      }
    } catch {
      continue; // next provider, then null
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Socratic explanation layer — the LLM is a coach, not an answer machine.
// ---------------------------------------------------------------------------

export interface SocraticExplanationInput {
  concept: string;
  selectedOption: string;
  distractorMisconception: string;
  correctOption: string;
  syllabusExcerpt: string;
}

const SOCRATIC_SYSTEM_PROMPT =
  "You are explaining a JAMB Mathematics concept to a struggling Nigerian " +
  "secondary school student. Be warm, direct, and encouraging. Never state " +
  "the final answer. Name the specific misconception in the student's " +
  "attempt. Ask exactly one guiding question that prompts self-correction. " +
  "Do not introduce any fact not present in the grounding material. Keep it " +
  "to 3-4 sentences. Use KaTeX for any math: inline with $...$, block with " +
  "$$...$$.";

function socraticUserPrompt(input: SocraticExplanationInput): string {
  return [
    `Concept: ${input.concept}`,
    `Student's incorrect answer: ${input.selectedOption} (${input.distractorMisconception})`,
    `Correct answer: ${input.correctOption}`,
    `Grounding material: ${input.syllabusExcerpt}`,
    "",
    "Write a short, encouraging, Socratic explanation that:",
    "- Does NOT state the answer",
    "- Names the specific likely misconception",
    "- Asks one guiding question to prompt self-correction",
  ].join("\n");
}

// Guardrail: "never state the final answer" enforced mechanically, not just
// by prompt discipline. Short strings (e.g. an option letter like "a") are
// skipped to avoid false positives.
function leaksAnswer(text: string, correctOption: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s$]/g, "");
  const answer = normalize(correctOption);
  if (answer.length < 3) return false;
  return normalize(text).includes(answer);
}

/**
 * Returns the Socratic explanation, or null on any failure (no key, network
 * error, timeout, or the model leaked the answer). Null means "serve the
 * fallback" — failures are logged server-side only; the student never sees
 * a raw error.
 */
export async function generateSocraticExplanation(
  input: SocraticExplanationInput,
): Promise<string | null> {
  const llm = await generateText({
    system: SOCRATIC_SYSTEM_PROMPT,
    user: socraticUserPrompt(input),
    temperature: 0.4,
    maxTokens: 300,
  });
  if (!llm) {
    console.warn(
      `[llm] socratic explanation unavailable for concept "${input.concept}" — serving fallback`,
    );
    return null;
  }
  if (leaksAnswer(llm.text, input.correctOption)) {
    console.warn(
      `[llm] socratic explanation rejected (answer-leak guard) for concept "${input.concept}"`,
    );
    return null;
  }
  return llm.text.trim();
}
