// Single LLM entry point so providers can be swapped without touching
// callers. OpenAI and Zhipu both speak the chat-completions shape.
//
// generateText NEVER throws and NEVER logs the key: it returns null on any
// failure (missing key, network error, non-200, timeout, empty body), and
// callers fall back to deterministic content. With no keys configured every
// route still works — the LLM only ever adds a diagnosis, never the math.

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

/** One deadline for the whole call, shared across providers. */
export const LLM_TIMEOUT_MS = 6_000;

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
  const deadline = Date.now() + LLM_TIMEOUT_MS;
  for (const provider of resolveProviders()) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
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
        signal: AbortSignal.timeout(remainingMs),
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
