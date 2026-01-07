export class ServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, options: { status: number; code: string }) {
    super(message);
    this.name = "ServiceError";
    this.status = options.status;
    this.code = options.code;
  }
}

export const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new ServiceError(`Missing environment variable: ${key}`, {
      status: 500,
      code: "missing_key",
    });
  }
  return value;
};

export const toServiceError = (error: unknown) => {
  if (error instanceof ServiceError) return error;
  return new ServiceError("Unexpected service error", {
    status: 500,
    code: "unexpected",
  });
};
