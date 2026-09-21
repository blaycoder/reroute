import { NextResponse } from "next/server";
import { loadProgress } from "@/lib/diagnostic-session";
import { jsonError } from "@/lib/http";
import type { DiagnosticProgress } from "@/types/api";

// Where a diagnostic stands, rebuilt from its attempts. This is how a refresh
// resumes from the last answered question, and how a finished session is loaded
// by id — it always describes the one student who took it.
export async function GET(
  _request: Request,
  { params }: { params: { diagnosticId: string } },
) {
  const progress = await loadProgress(params.diagnosticId);
  if (!progress) return jsonError("Diagnostic session not found", 404);
  const payload: DiagnosticProgress = progress;
  return NextResponse.json(payload);
}
