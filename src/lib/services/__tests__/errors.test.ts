import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceError, requireEnv, toServiceError } from "@/lib/services/errors";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("toServiceError", () => {
  it("returns ServiceError instances as-is", () => {
    const original = new ServiceError("Bad request", {
      status: 400,
      code: "bad_request",
    });

    const result = toServiceError(original);
    expect(result).toBe(original);
  });

  it("preserves Error messages", () => {
    const result = toServiceError(new Error("Boom"));
    expect(result.message).toBe("Boom");
    expect(result.code).toBe("unexpected");
    expect(result.status).toBe(500);
  });

  it("uses string errors directly", () => {
    const result = toServiceError("Direct failure");
    expect(result.message).toBe("Direct failure");
    expect(result.code).toBe("unexpected");
  });
});

describe("requireEnv", () => {
  it("throws ServiceError when missing", () => {
    delete process.env.MISSING_KEY;

    expect(() => requireEnv("MISSING_KEY")).toThrow(ServiceError);
    try {
      requireEnv("MISSING_KEY");
    } catch (error) {
      const serviceError = error as ServiceError;
      expect(serviceError.code).toBe("missing_env");
      expect(serviceError.status).toBe(500);
    }
  });
});
