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
    const body = await response.json();
    expect(body).toMatchObject({
      error: "Weather provider rejected the API key",
      code: "provider_error",
    });
    expect(body.debugId).toEqual(expect.any(String));
  });

  it("returns current weather when forecast fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            main: { temp: 10, humidity: 70 },
            weather: [{ description: "clear", icon: "01d" }],
            wind: { speed: 2 },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "forecast down" }), { status: 500 })
      );

    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/weather/route");
    const request = new NextRequest(
      "http://localhost/api/weather?lat=48.8566&lon=2.3522"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.current).toMatchObject({
      tempC: 10,
      description: "clear",
      icon: "01d",
      humidity: 70,
    });
    expect(body.errors?.forecast?.message).toBe(
      "Weather provider error (forecast)"
    );
  });
});
