import fs from "node:fs/promises";
import path from "node:path";
import { buildAirbnbSearchUrl } from "../src/lib/stays/providers/airbnbSearchLink";

type CityMeta = {
  name: string;
  lat: number;
  lon: number;
};

type CountryMetaEntry = {
  code: string;
  name: string;
  capital?: string | null;
  lat?: number | null;
  lon?: number | null;
  topCities?: CityMeta[];
};

type StayOutput = {
  id: string;
  title: string;
  lat: number;
  lon: number;
  price: number;
  currency: string;
  countryCode: string;
  imageUrl: string;
  rating: number;
  url: string;
  source: "mock";
};

const DEFAULT_PER_CITY = 150;
const DEFAULT_RADIUS_KM = 8;
const DEFAULT_WRITE_ALL = false;
const MAX_CITIES_PER_COUNTRY = 5;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    perCity: DEFAULT_PER_CITY,
    radiusKm: DEFAULT_RADIUS_KM,
    writeAll: DEFAULT_WRITE_ALL,
  };
  args.forEach((arg) => {
    if (arg.startsWith("--perCity=")) {
      const value = Number(arg.split("=")[1]);
      if (Number.isFinite(value) && value > 0) {
        options.perCity = Math.floor(value);
      }
    }
    if (arg.startsWith("--radiusKm=")) {
      const value = Number(arg.split("=")[1]);
      if (Number.isFinite(value) && value > 0) {
        options.radiusKm = value;
      }
    }
    if (arg.startsWith("--writeAll=")) {
      const value = arg.split("=")[1];
      options.writeAll = value === "true" || value === "1";
    }
  });
  return options;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const clampLat = (value: number) => Math.max(-89.999, Math.min(89.999, value));
const clampLon = (value: number) =>
  Math.max(-179.999, Math.min(179.999, value));

const kmToLatDelta = (km: number) => km / 110.574;
const kmToLonDelta = (km: number, lat: number) => {
  const denom = 111.32 * Math.cos(toRadians(lat));
  return km / (Math.abs(denom) < 0.0001 ? 0.0001 : denom);
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const xmur3 = (str: string) => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
};

const mulberry32 = (a: number) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const createRng = (seed: string) => {
  const seedFn = xmur3(seed);
  return mulberry32(seedFn());
};

const isValidLatLon = (lat: number, lon: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180 &&
  !(lat === 0 && lon === 0);

const loadCountries = async (): Promise<CountryMetaEntry[]> => {
  const root = process.cwd();
  const sourcePath = path.join(
    root,
    "src",
    "lib",
    "data",
    "countries",
    "countries.meta.json"
  );
  const raw = await fs.readFile(sourcePath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, CountryMetaEntry>;
  return Object.values(parsed)
    .filter((entry) => entry && typeof entry.code === "string")
    .sort((a, b) => a.code.localeCompare(b.code));
};

const pickCities = (country: CountryMetaEntry) => {
  const cities = (country.topCities ?? []).filter((city) =>
    isValidLatLon(city.lat, city.lon)
  );
  if (cities.length) {
    return cities.slice(0, MAX_CITIES_PER_COUNTRY);
  }
  if (isValidLatLon(country.lat ?? NaN, country.lon ?? NaN)) {
    const name = country.capital?.trim() || country.name;
    return [
      {
        name,
        lat: country.lat as number,
        lon: country.lon as number,
      },
    ];
  }
  return [];
};

const buildStay = (
  countryCode: string,
  city: CityMeta,
  index: number,
  radiusKm: number
): StayOutput => {
  const seed = `${countryCode}-${city.name}-${index}`;
  const rng = createRng(seed);
  const angle = rng() * Math.PI * 2;
  const radius = radiusKm * Math.sqrt(rng());
  const latOffset = (radius * Math.cos(angle)) / 110.574;
  const lonScale = 111.32 * Math.cos(toRadians(city.lat));
  const lonOffset =
    (radius * Math.sin(angle)) / (Math.abs(lonScale) < 0.0001 ? 0.0001 : lonScale);
  const lat = clampLat(city.lat + latOffset);
  const lon = clampLon(city.lon + lonOffset);

  const price = 60 + Math.floor(rng() * 391);
  const rating = Number((4.1 + rng() * 0.85).toFixed(2));
  const idBase = `${countryCode}-${slugify(city.name) || "stay"}-${index + 1}`;
  const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(idBase)}/240/160`;

  const bboxRadiusKm = Math.max(1, radiusKm * 0.4);
  const bboxLatDelta = kmToLatDelta(bboxRadiusKm);
  const bboxLonDelta = kmToLonDelta(bboxRadiusKm, lat);
  const bbox = {
    minLon: clampLon(lon - bboxLonDelta),
    minLat: clampLat(lat - bboxLatDelta),
    maxLon: clampLon(lon + bboxLonDelta),
    maxLat: clampLat(lat + bboxLatDelta),
  };
  const url = buildAirbnbSearchUrl({
    bbox,
    minPrice: Math.max(20, price - 10),
    maxPrice: price + 30,
    currency: "EUR",
  });

  return {
    id: idBase,
    title: `Stay in ${city.name}`,
    lat,
    lon,
    price,
    currency: "EUR",
    countryCode,
    imageUrl,
    rating,
    url,
    source: "mock",
  };
};

const generateDataset = async () => {
  const { perCity, radiusKm, writeAll } = parseArgs();
  const countries = await loadCountries();
  const root = process.cwd();
  const countriesDir = path.join(root, "public", "data", "stays", "countries");
  await fs.mkdir(countriesDir, { recursive: true });

  const allStays: StayOutput[] = [];
  const sampleCounts: Record<string, number> = {};
  let totalStays = 0;

  for (const country of countries) {
    const countryCode = country.code.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) continue;
    const cities = pickCities(country);
    if (!cities.length) continue;
    const stays: StayOutput[] = [];
    cities.forEach((city) => {
      for (let i = 0; i < perCity; i += 1) {
        stays.push(buildStay(countryCode, city, i, radiusKm));
      }
    });
    totalStays += stays.length;
    if (sampleCounts[countryCode] === undefined) {
      sampleCounts[countryCode] = stays.length;
    }
    if (writeAll) {
      allStays.push(...stays);
    }
    const outputPath = path.join(countriesDir, `${countryCode}.json`);
    await fs.writeFile(outputPath, JSON.stringify(stays, null, 2), "utf8");
  }

  if (writeAll) {
    const allPath = path.join(root, "public", "data", "stays.all.json");
    await fs.writeFile(allPath, JSON.stringify(allStays, null, 2), "utf8");
  }

  const exampleCodes = Object.keys(sampleCounts).slice(0, 5);
  console.log(
    `Generated stays for ${Object.keys(sampleCounts).length} countries. Total stays: ${totalStays}.`
  );
  exampleCodes.forEach((code) => {
    console.log(`  ${code}: ${sampleCounts[code]} stays`);
  });
  console.log(
    `Settings: perCity=${perCity}, radiusKm=${radiusKm}, writeAll=${writeAll}`
  );
};

generateDataset().catch((error) => {
  console.error(error);
  process.exit(1);
});
