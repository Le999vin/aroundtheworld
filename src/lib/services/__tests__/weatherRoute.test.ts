import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}));

describe("weather route", () => {
  beforeEach(() => {
    vi.stubEnv("OPENWEATHER_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns provider status and code when provider fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "bad key" }), { status: 401 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ list: [] }), { status: 200 })
      );

    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/weather/route");
    const request = new NextRequest(
      "http://localhost/api/weather?lat=47.3769&lon=8.5417"
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Weather provider error (current)",
      code: "provider_error",
    });
  });
});
