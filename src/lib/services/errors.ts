// src/lib/services/errors.ts

export type ServiceErrorCode =
  | "missing_env"
  | "bad_request"
  | "provider_error"
  | "provider_unsupported"
  | "rate_limited"
  | "not_found"
  | "unexpected";

export type ServiceErrorOptions = {
  status: number;               // HTTP Status
  code: ServiceErrorCode;       // Maschinencode
  details?: unknown;            // Optional: zusaetzliche Infos (Provider payload etc.)
  cause?: unknown;              // Optional: original error
};

export class ServiceError extends Error {
  status: number;
  code: ServiceErrorCode;
  details?: unknown;
  cause?: unknown;

  constructor(message: string, options: ServiceErrorOptions) {
    super(message);

    // Saubere Error-Identitaet (wichtig für Logs + shape-check)
    this.name = "ServiceError";

    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.cause = options.cause;
  }
}

/**
 * Env var sicher holen.
 * - Trimmt Spaces
 * - Optionally: Leere Strings gelten als fehlend
 */
export const requireEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new ServiceError(`Missing environment variable: ${key}`, {
      status: 500,
      code: "missing_env",
    });
  }
  return value;
};

/**
 * Type Guard, falls instanceof wegen Bundling/Edge mal nicht greift.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Type Guard, falls instanceof wegen Bundling/Edge mal nicht greift.
 */
export const isServiceError = (error: unknown): error is ServiceError => {
  if (!isRecord(error)) return false;
  const name = error["name"];
  const status = error["status"];
  const code = error["code"];
  return (
    name === "ServiceError" &&
    typeof status === "number" &&
    typeof code === "string"
  );
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message || "Unexpected service error";
  }
  if (typeof error === "string") return error;
  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }
  return "Unexpected service error";
};

/**
 * Macht aus beliebigen Errors einen ServiceError, OHNE die echte Ursache zu verlieren.
 * -> Genau das brauchst du, um "Unexpected service error" zu vermeiden.
 */
export const toServiceError = (error: unknown): ServiceError => {
  if (error instanceof ServiceError) return error;
  if (isServiceError(error)) return error as ServiceError;

  const message = getErrorMessage(error);
  const cause = error instanceof Error ? error : undefined;
  const details =
    !cause && typeof error !== "string" && error !== undefined ? error : undefined;

  return new ServiceError(message, {
    status: 500,
    code: "unexpected",
    cause,
    details,
  });
};

export type ApiErrorResponse = {
  error: string;
  code: ServiceErrorCode;
};

export const toErrorResponse = (error: unknown) => {
  const serviceError = toServiceError(error);
  return {
    status: serviceError.status,
    body: {
      error: serviceError.message || "Unexpected service error",
      code: serviceError.code,
    } as ApiErrorResponse,
    serviceError,
  };
};

export const logServiceError = (context: string, error: ServiceError) => {
  console.error(`[${context}] ${error.message}`, {
    code: error.code,
    status: error.status,
    stack: error.stack,
  });
};

export const readResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};
