import { NextResponse } from "next/server";
import type { z } from "zod";

// Shared helpers for the API routes: error envelope + Zod body parsing.

export function jsonError(
  error: string,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    details === undefined ? { error } : { error, details },
    { status },
  );
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: string[] };

/** Parse and validate a JSON request body against a Zod schema. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, issues: ["body is not valid JSON"] };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    };
  }
  return { ok: true, data: parsed.data };
}
