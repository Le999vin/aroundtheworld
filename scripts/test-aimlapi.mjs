import fs from "node:fs";
import path from "node:path";

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (!key) continue;
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const apiKey = process.env.AIML_API_KEY;
if (!apiKey) {
  console.error("Missing AIML_API_KEY in environment.");
  process.exit(1);
}

const baseUrl = process.env.AIML_API_BASE_URL ?? "https://api.aimlapi.com/v1";
const model = process.env.AIML_MODEL ?? "gpt-4o-mini";
const maxTokens = Number(process.env.AIML_MAX_TOKENS ?? 128) || 128;
const trimmedBase = baseUrl.replace(/\/+$/, "");
const baseWithV1 = trimmedBase.endsWith("/v1") ? trimmedBase : `${trimmedBase}/v1`;
const url = `${baseWithV1}/chat/completions`;

const payload = {
  model,
  messages: [{ role: "user", content: "Say hi in one short sentence." }],
  max_tokens: maxTokens,
  stream: false,
};

console.log("Requesting:", url);
const response = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const text = await response.text();
console.log("Status:", response.status);
console.log("Response (first 800 chars):");
console.log(text.slice(0, 800));
