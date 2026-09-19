// Normalizes free-text math answers so "$-4x + 12$", "-4X + 12" and
// "-4x+12" compare equal. Shared by the guided-check and verify routes.
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/\^?\\circ/g, "") // degree LaTeX before stripping symbols
    .replace(/[\s$°º]/g, "")
    .replace(/^\+/, "");
}
