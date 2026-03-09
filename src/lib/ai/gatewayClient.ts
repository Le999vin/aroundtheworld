const DEFAULT_AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const DEFAULT_AI_MODEL = "openai/gpt-4o-mini";
const TLS_CERT_ERROR_CODES = new Set([
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "CERT_HAS_EXPIRED",
]);

type GatewayMessageRole = "system" | "user" | "assistant";

type GatewayMessage = {
  role: GatewayMessageRole;
  content: string;
};

type JsonSchemaResponseFormat = {
  type: "json_schema";
  json_schema: {
    name: string;
    schema: unknown;
    strict?: boolean;
  };
};

type GatewayChatCompletionRequest = {
  messages: GatewayMessage[];
  stream?: boolean;
  response_format?: JsonSchemaResponseFormat;
  temperature?: number;
  top_p?: number;
};

const asNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toBaseUrl = (value?: string) => {
  const fallback = DEFAULT_AI_GATEWAY_BASE_URL;
  const trimmed = asNonEmptyString(value) ?? fallback;
  return trimmed.replace(/\/+$/, "");
};

const toModel = (value?: string) => asNonEmptyString(value) ?? DEFAULT_AI_MODEL;
const isDev = process.env.NODE_ENV !== "production";

let insecureTlsModeEnabled = process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";

export const getAiGatewayConfig = () => {
  const apiKey = asNonEmptyString(process.env.AI_GATEWAY_API_KEY);
  if (!apiKey) {
    throw new Error("Missing AI_GATEWAY_API_KEY");
  }

  return {
    apiKey,
    baseUrl: toBaseUrl(process.env.AI_GATEWAY_BASE_URL),
    model: toModel(process.env.AI_MODEL),
  };
};

export const requestAiGatewayChatCompletion = async (
  payload: GatewayChatCompletionRequest,
  options?: { signal?: AbortSignal }
) => {
  const config = getAiGatewayConfig();
  const url = `${config.baseUrl}/chat/completions`;
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      ...payload,
    }),
    cache: "no-store",
    signal: options?.signal,
  };

  try {
    return await fetch(url, requestInit);
  } catch (error) {
    if (isDev && isTlsCertificateError(error)) {
      if (!insecureTlsModeEnabled) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        insecureTlsModeEnabled = true;
        console.warn("[ai-gateway] TLS certificate validation failed; enabling insecure TLS for local dev.");
      }
      return fetch(url, requestInit);
    }
    throw error;
  }
};

const extractTextFromContentPart = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (record.type === "text" && typeof record.text === "string") {
    return record.text;
  }
  if (typeof record.content === "string") {
    return record.content;
  }
  return "";
};

export const extractTextFromChatCompletionContent = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => extractTextFromContentPart(part)).join("");
  }
  return "";
};

export const extractTextFromChatCompletionPayload = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0];
  if (!first || typeof first !== "object") return "";
  const firstChoice = first as Record<string, unknown>;
  const message = firstChoice.message;
  if (!message || typeof message !== "object") return "";
  const messageRecord = message as Record<string, unknown>;
  return extractTextFromChatCompletionContent(messageRecord.content);
};

export const getGatewayErrorCode = (error: unknown) => {
  if (!error || typeof error !== "object") return undefined;
  const record = error as { code?: string; cause?: { code?: string } };
  return record.code ?? record.cause?.code;
};

export const isTlsCertificateError = (error: unknown) => {
  const code = getGatewayErrorCode(error);
  return Boolean(code && TLS_CERT_ERROR_CODES.has(code));
};

export const isGatewayUnavailable = (error: unknown) => {
  const code = getGatewayErrorCode(error);
  if (!code) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return message.includes("ECONNREFUSED") || message.includes("connect ECONNREFUSED");
  }
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "EHOSTUNREACH"
  );
};

export const readGatewayErrorMessage = async (response: Response, fallbackLabel = "AI Gateway") => {
  const fallback = `${fallbackLabel} upstream failed (${response.status}).`;
  const raw = await response.text().catch(() => "");
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };
    const message = asNonEmptyString(parsed.error?.message) ?? asNonEmptyString(parsed.message);
    if (message) {
      return `${fallback} ${message.slice(0, 300)}`;
    }
  } catch {
    // Fall through to raw text.
  }

  return `${fallback} ${raw.slice(0, 300)}`;
};

export {
  DEFAULT_AI_GATEWAY_BASE_URL,
  DEFAULT_AI_MODEL,
  type GatewayChatCompletionRequest,
  type GatewayMessage,
  type JsonSchemaResponseFormat,
};
