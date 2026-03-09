import { describe, expect, it } from "vitest";
import {
  normalizeConfirmationInput,
  parsePendingActionDecision,
} from "@/lib/ai/atlasAssistantConfirm";

describe("atlasAssistantConfirm", () => {
  it("normalizes punctuation and spacing", () => {
    expect(normalizeConfirmationInput("  Ja!  ")).toBe("ja");
    expect(normalizeConfirmationInput("Let’s   go")).toBe("let s go");
  });

  it("parses confirm phrases", () => {
    expect(parsePendingActionDecision("ja")).toBe("confirm");
    expect(parsePendingActionDecision("ok")).toBe("confirm");
    expect(parsePendingActionDecision("okay")).toBe("confirm");
    expect(parsePendingActionDecision("yes")).toBe("confirm");
    expect(parsePendingActionDecision("go")).toBe("confirm");
    expect(parsePendingActionDecision("let’s go")).toBe("confirm");
    expect(parsePendingActionDecision("zeige bitte")).toBe("confirm");
  });

  it("parses cancel phrases", () => {
    expect(parsePendingActionDecision("nein")).toBe("cancel");
    expect(parsePendingActionDecision("no")).toBe("cancel");
    expect(parsePendingActionDecision("stop")).toBe("cancel");
    expect(parsePendingActionDecision("abbrechen")).toBe("cancel");
  });

  it("returns null for normal queries", () => {
    expect(parsePendingActionDecision("wie ist das wetter in suedafrika")).toBeNull();
  });
});
