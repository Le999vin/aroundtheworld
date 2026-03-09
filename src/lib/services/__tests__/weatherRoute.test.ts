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
    vi.resetModules();
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

  it("maps TLS-like failures to ssl_error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const tlsError = new Error("unable to get local issuer certificate");
    const fetchMock = vi.fn().mockRejectedValue(tlsError);
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/weather/route");
    const request = new NextRequest(
      "http://localhost/api/weather?lat=46.948&lon=7.4474"
    );
    const response = await GET(request);

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "provider_error",
      upstreamHint: "ssl_error",
      error: "TLS Zertifikat nicht vertrauenswuerdig. Bitte Proxy/CA konfigurieren.",
    });
  });

  it("serves stale fallback data with cache header when fresh request fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            main: { temp: 12, humidity: 65 },
            weather: [{ description: "clear", icon: "01d" }],
            wind: { speed: 3 },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            list: [
              {
                dt: 1_700_000_000,
                main: { temp_min: 10, temp_max: 14 },
                weather: [{ description: "sunny", icon: "01d" }],
              },
            ],
          }),
          { status: 200 }
        )
      )
      .mockRejectedValueOnce(new Error("unable to get local issuer certificate"))
      .mockRejectedValueOnce(new Error("unable to get local issuer certificate"));

    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/weather/route");
    const request = new NextRequest(
      "http://localhost/api/weather?lat=52.52&lon=13.405"
    );

    const first = await GET(request);
    expect(first.status).toBe(200);
    expect(first.headers.get("x-weather-cache")).toBeNull();

    const second = await GET(request);
    expect(second.status).toBe(200);
    expect(second.headers.get("x-weather-cache")).toBe("stale-fallback");

    const body = await second.json();
    expect(body.current?.tempC).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
