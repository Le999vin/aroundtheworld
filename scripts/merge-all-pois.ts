// Usage: node scripts/merge-all-pois.ts [--geocode]
import fs from "node:fs/promises";
import path from "node:path";

type Poi = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  source: "static";
  countryCode: string;
  city: string;
  address: string;
};

type RawPoi = {
  id?: string;
  name?: string;
  category?: string;
  lat?: number;
  lon?: number;
  source?: string;
  countryCode?: string;
  cityId?: string;
  city?: string;
  address?: string;
};

type BestOfEntry = {
  name: string;
  category: string;
  city?: string;
  address?: string;
  lat?: number;
  lon?: number;
};

type BestOfConfig = Record<string, BestOfEntry[]>;

type GeocodeResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
};

const ROOT = process.cwd();
const DATASET_HINTS = [
  path.join(ROOT, "src", "lib", "data", "pois", "datasets"),
  path.join(ROOT, "public", "data", "pois", "datasets"),
];
const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "out",
  ".turbo",
]);

const BESTOF_PATHS = [
  path.join(ROOT, "src", "lib", "data", "pois", "datasets", "bestof", "bestof.generated.json"),
  path.join(ROOT, "scripts", "bestof.config.json"),
];

const CACHE_DIR = path.join(ROOT, "scripts", ".cache");
const NOMINATIM_CACHE_PATH = path.join(CACHE_DIR, "nominatim.json");
const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? "";
const ENABLE_GEOCODE =
  process.argv.includes("--geocode") || process.env.ENABLE_GEOCODE === "1";
const RATE_LIMIT_MS = 1000;
const DEDUPE_DISTANCE_KM = 0.15;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;

const schedule = async <T,>(fn: () => Promise<T>) => {
  const now = Date.now();
  const waitMs = Math.max(0, RATE_LIMIT_MS - (now - lastRequestAt));
  if (waitMs > 0) await sleep(waitMs);
  lastRequestAt = Date.now();
  return fn();
};

const fetchJson = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": NOMINATIM_USER_AGENT,
      "Accept-Language": "en",
    },
  });
  if (!response.ok) {
    throw new Error(`Nominatim request failed (${response.status})`);
  }
  return (await response.json()) as GeocodeResult | GeocodeResult[];
};

const loadNominatimCache = async () => {
  try {
    const raw = await fs.readFile(NOMINATIM_CACHE_PATH, "utf8");
    return JSON.parse(raw) as Record<string, GeocodeResult | null>;
  } catch (error) {
    return {};
  }
};

const saveNominatimCache = async (cache: Record<string, GeocodeResult | null>) => {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(NOMINATIM_CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
};

const searchGeocode = async (
  query: string,
  countryCode: string,
  cache: Record<string, GeocodeResult | null>
) => {
  const cacheKey = `${countryCode}:${query}`;
  if (cacheKey in cache) return cache[cacheKey];
  const url = new URL(`${NOMINATIM_URL}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", countryCode.toLowerCase());
  try {
    const data = await schedule(() => fetchJson(url.toString()));
    const result = Array.isArray(data) ? data[0] : data;
    cache[cacheKey] = result ?? null;
    return result ?? null;
  } catch (error) {
    console.warn(`Geocode failed for "${query}": ${(error as Error).message}`);
    cache[cacheKey] = null;
    return null;
  }
};

const buildAddress = (data?: GeocodeResult | null) => {
  if (!data) return "";
  const address = data.address ?? {};
  const road =
    address.road ??
    address.pedestrian ??
    address.footway ??
    address.path ??
    address.square ??
    address.place ??
    address.neighbourhood ??
    address.suburb ??
    address.village ??
    address.town ??
    address.city;
  if (road) {
    const houseNumber = address.house_number;
    return houseNumber ? `${road} ${houseNumber}` : road;
  }
  if (data.display_name) {
    return data.display_name.split(",")[0]?.trim() ?? "";
  }
  return "";
};

const buildCity = (data?: GeocodeResult | null) => {
  if (!data) return "";
  const address = data.address ?? {};
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    ""
  );
};

const normalizeString = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\u0131/g, "i")
    .replace(/\u015f/g, "s")
    .replace(/\u011f/g, "g")
    .replace(/\u00f6/g, "o")
    .replace(/\u00fc/g, "u")
    .replace(/\u00e7/g, "c")
    .replace(/\u00e4/g, "a")
    .replace(/\u00df/g, "ss")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const slugify = (value: string) => normalizeString(value).replace(/\s+/g, "-");

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");

const deriveCityFromFilename = (filePath: string) => {
  const base = path.basename(filePath, path.extname(filePath));
  const cleaned = base.replace(/[_-]+/g, " ");
  return toTitleCase(cleaned);
};

const isCountryFileName = (filePath: string) => {
  const base = path.basename(filePath, path.extname(filePath));
  return /^[A-Za-z]{2}$/.test(base);
};

const isJsonFile = (filePath: string) => filePath.toLowerCase().endsWith(".json");

const shouldIgnoreFile = (filePath: string) => {
  const base = path.basename(filePath).toLowerCase();
  return base.includes("global") || base.includes("sample") || base.includes("registry");
};

const haversineKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const radiusKm = 6371;
  const toRadians = (val: number) => (val * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * radiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
};

const buildUniqueId = (base: string, used: Set<string>) => {
  let id = base;
  let counter = 2;
  while (used.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  used.add(id);
  return id;
};

const mergeBetterFields = (target: Poi, candidate: Poi) => {
  if (!target.address && candidate.address) {
    target.address = candidate.address;
  }
  if (!target.city && candidate.city) {
    target.city = candidate.city;
  }
  if (!Number.isFinite(target.lat) && Number.isFinite(candidate.lat)) {
    target.lat = candidate.lat;
  }
  if (!Number.isFinite(target.lon) && Number.isFinite(candidate.lon)) {
    target.lon = candidate.lon;
  }
};

const findDatasetRoots = async () => {
  const roots: string[] = [];
  for (const hint of DATASET_HINTS) {
    try {
      const stat = await fs.stat(hint);
      if (stat.isDirectory()) roots.push(hint);
    } catch (error) {
      continue;
    }
  }

  if (roots.length > 0) return roots;

  const queue = [ROOT];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.name === "datasets") {
        roots.push(fullPath);
        continue;
      }
      queue.push(fullPath);
    }
  }

  return roots;
};

const collectJsonFiles = async (dirPath: string) => {
  const results: string[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectJsonFiles(fullPath);
      results.push(...nested);
    } else if (entry.isFile() && isJsonFile(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
};

const loadJsonArray = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(`Expected array in ${filePath}`);
  }
  return data as RawPoi[];
};

const loadBestOfConfig = async () => {
  for (const configPath of BESTOF_PATHS) {
    try {
      const raw = await fs.readFile(configPath, "utf8");
      return JSON.parse(raw) as BestOfConfig;
    } catch (error) {
      continue;
    }
  }
  return null;
};

const main = async () => {
  const datasetRoots = await findDatasetRoots();
  if (datasetRoots.length === 0) {
    throw new Error("No datasets folder found.");
  }

  const bestOfConfig = await loadBestOfConfig();
  const canGeocode = ENABLE_GEOCODE && NOMINATIM_USER_AGENT.length > 0;
  if (ENABLE_GEOCODE && !canGeocode) {
    console.warn("ENABLE_GEOCODE set but NOMINATIM_USER_AGENT is missing. Geocoding disabled.");
  }

  const nominatimCache = canGeocode ? await loadNominatimCache() : {};
  let cacheDirty = false;

  const totals = {
    countries: 0,
    before: 0,
    city: 0,
    bestof: 0,
    added: 0,
    deduped: 0,
    after: 0,
  };

  for (const root of datasetRoots) {
    const countriesDir = path.join(root, "countries");
    const citiesDir = path.join(root, "cities");
    const hasCountriesDir = await fs
      .stat(countriesDir)
      .then((stat: any) => stat.isDirectory())
      .catch(() => false);
    const hasCitiesDir = await fs
      .stat(citiesDir)
      .then((stat: any) => stat.isDirectory())
      .catch(() => false);

    const countryFiles = hasCountriesDir
      ? await collectJsonFiles(countriesDir)
      : (await collectJsonFiles(root)).filter(
          (file) => isCountryFileName(file) && !shouldIgnoreFile(file)
        );

    const cityFiles = hasCitiesDir
      ? await collectJsonFiles(citiesDir)
      : (await collectJsonFiles(root)).filter(
          (file) => !isCountryFileName(file) && !shouldIgnoreFile(file)
        );

    const cityFileMeta = new Map<string, { cityName: string; filePath: string }>();
    for (const filePath of cityFiles) {
      cityFileMeta.set(filePath, {
        cityName: deriveCityFromFilename(filePath),
        filePath,
      });
    }

    const cityPoiByCountry = new Map<string, Array<{ poi: RawPoi; cityName: string }>>();
    for (const filePath of cityFiles) {
      const cityName = cityFileMeta.get(filePath)?.cityName ?? "";
      const data = await loadJsonArray(filePath);
      for (const poi of data) {
        const countryCode = (poi.countryCode ?? "").toString().toUpperCase();
        if (!countryCode) continue;
        if (!cityPoiByCountry.has(countryCode)) {
          cityPoiByCountry.set(countryCode, []);
        }
        cityPoiByCountry.get(countryCode)?.push({ poi, cityName });
      }
    }

    for (const countryFile of countryFiles) {
      const countryCode = path
        .basename(countryFile, path.extname(countryFile))
        .toUpperCase();
      if (!countryCode) continue;

      const rawCountryPois = await loadJsonArray(countryFile);
      const output: Poi[] = [];
      const usedIds = new Set<string>();
      const nameCategoryIndex = new Map<string, number>();

      for (const poi of rawCountryPois) {
        if (!poi.name || !poi.category) continue;
        const lat = Number(poi.lat);
        const lon = Number(poi.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const normalizedAddress = (poi.address ?? "").toString().trim();
        const normalizedCity = (poi.city ?? "").toString().trim();
        const item: Poi = {
          id: poi.id ?? buildUniqueId(`country-${countryCode.toLowerCase()}-${slugify(poi.name)}`, usedIds),
          name: poi.name,
          category: poi.category,
          lat,
          lon,
          source: "static",
          countryCode,
          address: normalizedAddress,
          city: normalizedCity,
        };
        usedIds.add(item.id);
        const key = `${normalizeString(item.name)}|${item.category}`;
        nameCategoryIndex.set(key, output.length);
        output.push(item);
      }

      const stats = {
        before: output.length,
        cityCount: 0,
        bestofCount: 0,
        added: 0,
        deduped: 0,
      };

      const cityEntries = cityPoiByCountry.get(countryCode) ?? [];
      stats.cityCount = cityEntries.length;

      const upsertCandidate = (candidate: Poi) => {
        const key = `${normalizeString(candidate.name)}|${candidate.category}`;
        const existingIndex = nameCategoryIndex.get(key);
        if (existingIndex !== undefined) {
          mergeBetterFields(output[existingIndex], candidate);
          stats.deduped += 1;
          return;
        }

        const nearIndex = output.findIndex(
          (poi) =>
            poi.category === candidate.category &&
            haversineKm(poi, candidate) < DEDUPE_DISTANCE_KM
        );
        if (nearIndex >= 0) {
          mergeBetterFields(output[nearIndex], candidate);
          nameCategoryIndex.set(key, nearIndex);
          stats.deduped += 1;
          return;
        }

        output.push(candidate);
        nameCategoryIndex.set(key, output.length - 1);
        stats.added += 1;
      };

      for (const entry of cityEntries) {
        const poi = entry.poi;
        if (!poi.name || !poi.category) continue;
        const lat = Number(poi.lat);
        const lon = Number(poi.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const cityName = (poi.city ?? entry.cityName ?? "").toString().trim();
        const address = (poi.address ?? "").toString().trim();
        const citySlug = slugify(cityName || entry.cityName || "city");
        const poiSlug = slugify(poi.name);
        const idBase = `country-${countryCode.toLowerCase()}-${citySlug}-${poiSlug}`;
        const candidate: Poi = {
          id: buildUniqueId(idBase, usedIds),
          name: poi.name,
          category: poi.category,
          lat,
          lon,
          source: "static",
          countryCode,
          city: cityName,
          address,
        };
        upsertCandidate(candidate);
      }

      const bestOfEntries = bestOfConfig?.[countryCode] ?? [];
      stats.bestofCount = bestOfEntries.length;

      for (const entry of bestOfEntries) {
        if (!entry.name || !entry.category) continue;
        let lat = entry.lat;
        let lon = entry.lon;
        let address = (entry.address ?? "").toString().trim();
        let city = (entry.city ?? "").toString().trim();

        if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && canGeocode) {
          const queryParts = [entry.name, entry.address, entry.city, countryCode]
            .filter(Boolean)
            .join(", ");
          const geo = await searchGeocode(queryParts, countryCode, nominatimCache);
          if (geo && geo.lat && geo.lon) {
            lat = Number(geo.lat);
            lon = Number(geo.lon);
            address = address || buildAddress(geo);
            city = city || buildCity(geo);
            cacheDirty = true;
          }
        }

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          continue;
        }

        const citySlug = slugify(city || "city");
        const poiSlug = slugify(entry.name);
        const idBase = `country-${countryCode.toLowerCase()}-${citySlug}-${poiSlug}`;
        const candidate: Poi = {
          id: buildUniqueId(idBase, usedIds),
          name: entry.name,
          category: entry.category,
          lat: Number(lat),
          lon: Number(lon),
          source: "static",
          countryCode,
          city,
          address,
        };
        upsertCandidate(candidate);
      }

      for (const poi of output) {
        poi.address = (poi.address ?? "").toString();
        poi.city = (poi.city ?? "").toString();
        poi.countryCode = countryCode;
        poi.source = "static";
      }

      await fs.writeFile(countryFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");

      const afterCount = output.length;
      totals.countries += 1;
      totals.before += stats.before;
      totals.city += stats.cityCount;
      totals.bestof += stats.bestofCount;
      totals.added += stats.added;
      totals.deduped += stats.deduped;
      totals.after += afterCount;

      console.log(
        `${countryCode}: before=${stats.before} city=${stats.cityCount} bestof=${stats.bestofCount} added=${stats.added} deduped=${stats.deduped} after=${afterCount}`
      );
    }
  }

  if (cacheDirty && canGeocode) {
    await saveNominatimCache(nominatimCache);
  }

  console.log(
    `TOTAL: countries=${totals.countries} before=${totals.before} city=${totals.city} bestof=${totals.bestof} added=${totals.added} deduped=${totals.deduped} after=${totals.after}`
  );
};

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
