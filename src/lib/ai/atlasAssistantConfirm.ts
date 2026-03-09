export type PendingActionDecision = "confirm" | "cancel";

const CONFIRM_PHRASES = new Set([
  "ja",
  "ja bitte",
  "yes",
  "ok",
  "okay",
  "okey",
  "mach",
  "mach das",
  "mach bitte",
  "zeige",
  "zeige bitte",
  "go",
  "lets go",
  "let s go",
  "gerne",
  "fuehr mich hin",
  "fuehr mich",
  "fuehr mich bitte",
  "fuehr mich dahin",
  "fuehr mich dorthin",
  "fuhr mich hin",
]);

const CANCEL_PHRASES = new Set([
  "nein",
  "no",
  "stop",
  "abbrechen",
  "cancel",
  "nicht",
  "lass sein",
  "nein danke",
]);

const stripDiacritics = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const normalizeConfirmationInput = (text: string) =>
  stripDiacritics(
    text
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
  )
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const parsePendingActionDecision = (
  text: string
): PendingActionDecision | null => {
  const normalized = normalizeConfirmationInput(text);
  if (!normalized) return null;

  if (CONFIRM_PHRASES.has(normalized)) return "confirm";
  if (CANCEL_PHRASES.has(normalized)) return "cancel";

  const words = normalized.split(" ");
  if (words.length <= 3) {
    if (normalized.startsWith("ja ")) return "confirm";
    if (normalized.startsWith("ok ")) return "confirm";
    if (normalized.startsWith("okay ")) return "confirm";
    if (normalized.startsWith("zeige ")) return "confirm";
    if (normalized.startsWith("yes ")) return "confirm";
    if (normalized.startsWith("nein ")) return "cancel";
    if (normalized.startsWith("no ")) return "cancel";
  }

  return null;
};
