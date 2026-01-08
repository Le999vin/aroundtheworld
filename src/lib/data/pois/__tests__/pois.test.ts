import { describe, expect, it } from "vitest";
import { getPois, normalizeCountryCode } from "@/lib/data/pois";

describe("normalizeCountryCode", () => {
  it("uppercases and trims codes", () => {
    expect(normalizeCountryCode(" ch ")).toBe("CH");
  });

  it("returns null for empty input", () => {
    expect(normalizeCountryCode("")).toBeNull();
  });
});

describe("getPois", () => {
  it("selects city dataset by bbox", async () => {
    const pois = await getPois({ lat: 47.3769, lon: 8.5417, limit: 3 });
    expect(pois.length).toBeGreaterThan(0);
    expect(pois.every((poi) => poi.cityId === "zurich")).toBe(true);
  });

  it("applies category filter and limit", async () => {
    const pois = await getPois({
      city: "paris",
      category: "landmarks",
      limit: 2,
    });
    expect(pois).toHaveLength(2);
    expect(pois.every((poi) => poi.category === "landmarks")).toBe(true);
  });

  it("returns empty for unknown city dataset", async () => {
    const pois = await getPois({ city: "unknown-city" });
    expect(pois).toHaveLength(0);
  });
});
