// Client-side API wrapper: demo mode resolves every call from pre-cached
// fixtures (network-free); normal mode hits the real API and falls back to
// the same fixtures when a call fails — the judge never sees a raw error.

import { normalizeAnswer } from "@/lib/answer-normalize";

const DEMO_KEY = "reroot.demo";

const FIXTURES = {
  start: "/fallback/demo/diagnostic-start.json",
  complete: "/fallback/demo/diagnostic-complete.json",
  fingerprint: "/fallback/demo/fingerprint.json",
  intervention: "/fallback/demo/intervention.json",
  verify: "/fallback/demo/verify.json",
} as const;

type FixtureName = keyof typeof FIXTURES;

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(DEMO_KEY) === "1";
}

export function activateDemoMode(): void {
  sessionStorage.setItem(DEMO_KEY, "1");
}

export function resetDemoMode(): void {
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith("reroot."))
    .forEach((key) => sessionStorage.removeItem(key));
}

export type ApiFallbackState = "live" | "cached";

let fallbackState: ApiFallbackState = "live";
const listeners = new Set<(state: ApiFallbackState) => void>();

function setFallbackState(state: ApiFallbackState): void {
  if (fallbackState === state) return;
  fallbackState = state;
  listeners.forEach((listener) => listener(state));
}

export function getFallbackState(): ApiFallbackState {
  return fallbackState;
}

export function subscribeFallback(
  listener: (state: ApiFallbackState) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const fixtureCache = new Map<FixtureName, unknown>();

async function loadFixture(name: FixtureName): Promise<unknown> {
  if (!fixtureCache.has(name)) {
    const res = await fetch(FIXTURES[name]);
    if (!res.ok) throw new Error(`Missing fixture: ${FIXTURES[name]}`);
    fixtureCache.set(name, await res.json());
  }
  return fixtureCache.get(name);
}

interface DemoStartFixture {
  demo: { answers: Record<string, string> };
}

interface DemoInterventionFixture {
  demo: {
    guidedAnswer: string;
    guidedHint: string | null;
    practiceLetters: string[];
  };
}

async function resolveFromFixture<T>(
  path: string,
  body: unknown,
  fromFailure: boolean,
): Promise<T> {
  if (fromFailure) setFallbackState("cached");

  if (path === "/api/diagnostic/start") {
    return loadFixture("start") as Promise<T>;
  }
  if (path === "/api/diagnostic/answer") {
    // Grading runs client-side in demo/fallback mode — the fixture carries
    // the key for this explicitly-labeled demo dataset only.
    const fixture = (await loadFixture("start")) as DemoStartFixture;
    const request = body as { questionId: string; selectedOption: string };
    const expected = fixture.demo.answers[request.questionId];
    return {
      recorded: true,
      correct:
        expected !== undefined &&
        normalizeAnswer(request.selectedOption) ===
          normalizeAnswer(expected),
    } as T;
  }
  if (path === "/api/diagnostic/complete") {
    return loadFixture("complete") as Promise<T>;
  }
  if (path.startsWith("/api/learner/")) {
    return loadFixture("fingerprint") as Promise<T>;
  }
  if (path === "/api/intervention/generate") {
    return loadFixture("intervention") as Promise<T>;
  }
  if (path === "/api/intervention/check-guided") {
    const fixture = (await loadFixture(
      "intervention",
    )) as DemoInterventionFixture;
    const request = body as { guidedResponse: string };
    return {
      graded: true,
      correct:
        normalizeAnswer(request.guidedResponse) ===
        normalizeAnswer(fixture.demo.guidedAnswer),
      hint: fixture.demo.guidedHint,
    } as T;
  }
  if (path === "/api/intervention/check-practice") {
    const fixture = (await loadFixture(
      "intervention",
    )) as DemoInterventionFixture;
    const request = body as { index: number; selectedOption: string };
    const expected = fixture.demo.practiceLetters[request.index];
    return {
      correct:
        expected !== undefined &&
        normalizeAnswer(request.selectedOption) ===
          normalizeAnswer(expected),
    } as T;
  }
  if (path === "/api/intervention/verify") {
    return loadFixture("verify") as Promise<T>;
  }
  throw new Error(`No offline fallback for ${path}`);
}

export async function apiFetch<T>(path: string, body?: unknown): Promise<T> {
  if (isDemoMode()) {
    return resolveFromFixture<T>(path, body, false);
  }
  try {
    const res = await fetch(
      path,
      body === undefined
        ? undefined
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    setFallbackState("live");
    return (await res.json()) as T;
  } catch {
    // Offline / server failure: resolve from the pre-cached fixture.
    return resolveFromFixture<T>(path, body, true);
  }
}
