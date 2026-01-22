import type { Country } from "@/lib/types";

const ALIAS_TO_CODE: Record<string, string> = {
  marokko: "MA",
  marocco: "MA",
  morocco: "MA",
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const levenshteinDistance = (a: string, b: string) => {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (!aLen) return bLen;
  if (!bLen) return aLen;

  const dp = Array.from({ length: aLen + 1 }, () =>
    new Array<number>(bLen + 1).fill(0)
  );
  for (let i = 0; i <= aLen; i += 1) dp[i][0] = i;
  for (let j = 0; j <= bLen; j += 1) dp[0][j] = j;

  for (let i = 1; i <= aLen; i += 1) {
    for (let j = 1; j <= bLen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[aLen][bLen];
};

const similarity = (a: string, b: string) => {
  if (!a || !b) return 0;
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen ? 1 - distance / maxLen : 0;
};

export const resolveCountryCodeFromText = (
  text: string,
  countriesList: Country[]
) => {
  if (!text) return null;
  const normalizedText = normalizeText(text);
  if (!normalizedText) return null;

  for (const [alias, code] of Object.entries(ALIAS_TO_CODE)) {
    const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, "i");
    if (pattern.test(normalizedText)) return code;
  }

  const tokens = normalizedText.split(" ");
  const byCode = new Map(
    countriesList.map((country) => [country.code.toUpperCase(), country.code])
  );
  for (const token of tokens) {
    if (token.length === 2 || token.length === 3) {
      const code = byCode.get(token.toUpperCase());
      if (code) return code;
    }
  }

  let bestMatch: { code: string; score: number; length: number } | null = null;
  for (const country of countriesList) {
    const normalizedName = normalizeText(country.name);
    if (!normalizedName) continue;
    if (normalizedText === normalizedName) {
      return country.code;
    }
    if (normalizedText.includes(normalizedName)) {
      const score = normalizedName.length / Math.max(normalizedText.length, 1);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { code: country.code, score, length: normalizedName.length };
      }
    }
  }
  if (bestMatch) return bestMatch.code;

  let fuzzyBest: { code: string; score: number } | null = null;
  for (const country of countriesList) {
    const normalizedName = normalizeText(country.name);
    if (!normalizedName) continue;
    const score = similarity(normalizedText, normalizedName);
    if (!fuzzyBest || score > fuzzyBest.score) {
      fuzzyBest = { code: country.code, score };
    }
  }

  if (fuzzyBest && fuzzyBest.score >= 0.88) {
    return fuzzyBest.code;
  }

  return null;
};
