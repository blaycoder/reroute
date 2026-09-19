import { describe, expect, it } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
  it("keeps a text color alongside a custom font-size", () => {
    // Regression: tailwind-merge treated text-body as a color and dropped
    // text-surface, giving dark text on the primary button.
    expect(cn("bg-primary text-surface", "min-h-xxxl text-body")).toBe(
      "bg-primary text-surface min-h-xxxl text-body",
    );
  });

  it("still resolves real conflicts", () => {
    expect(cn("text-small", "text-body")).toBe("text-body");
    expect(cn("text-surface", "text-textPrimary")).toBe("text-textPrimary");
  });
});
