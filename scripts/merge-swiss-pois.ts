const fs = require("node:fs/promises");
const path = require("node:path");

type Poi = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  source: "static";
  countryCode: "CH";
  address?: string;
  city?: string;
};

type RawPoi = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  source: "static";
  countryCode?: string;
  cityId?: string;
  city?: string;
  address?: string;
};

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
};

const ROOT = process.cwd();
const CH_PATH = path.join(
  ROOT,
  "src",
  "lib",
  "data",
  "pois",
  "datasets",
  "countries",
  "CH.json"
);
const ZURICH_PATH = path.join(
  ROOT,
  "src",
  "lib",
  "data",
  "pois",
  "datasets",
  "cities",
  "zurich.json"
);

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  "GlobalTravelAtlas/1.0 (contact: https://example.com)";
const RATE_LIMIT_MS = 1100;
const DEDUPE_DISTANCE_KM = 0.15;
const ZURICH_CITY = "Z\u00fcrich";

const searchCache = new Map<string, NominatimResult | null>();
const reverseCache = new Map<string, NominatimResult | null>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;

const schedule = async <T,>(fn: () => Promise<T>) => {
  const now = Date.now();
  const waitMs = Math.max(0, RATE_LIMIT_MS - (now - lastRequestAt));
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  lastRequestAt = Date.now();
  return fn();
};

const fetchJson = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": NOMINATIM_USER_AGENT,
      "Accept-Language": "de",
    },
  });
  if (!response.ok) {
    throw new Error(`Nominatim request failed (${response.status})`);
  }
  return (await response.json()) as NominatimResult | NominatimResult[];
};

const reverseGeocode = async (lat: number, lon: number) => {
  const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  if (reverseCache.has(key)) return reverseCache.get(key) ?? null;
  const url = new URL(`${NOMINATIM_URL}/reverse`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lon", lon.toString());
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  try {
    const data = await schedule(() => fetchJson(url.toString()));
    const result = Array.isArray(data) ? data[0] : data;
    reverseCache.set(key, result ?? null);
    return result ?? null;
  } catch (error) {
    console.warn(`Reverse geocode failed for ${key}: ${(error as Error).message}`);
    reverseCache.set(key, null);
    return null;
  }
};

const searchGeocode = async (query: string) => {
  if (searchCache.has(query)) return searchCache.get(query) ?? null;
  const url = new URL(`${NOMINATIM_URL}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "ch");
  try {
    const data = await schedule(() => fetchJson(url.toString()));
    const result = Array.isArray(data) ? data[0] : data;
    searchCache.set(query, result ?? null);
    return result ?? null;
  } catch (error) {
    console.warn(`Search geocode failed for "${query}": ${(error as Error).message}`);
    searchCache.set(query, null);
    return null;
  }
};

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugify = (value: string) => normalizeName(value).replace(/\s+/g, "-");

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

const buildAddress = (data?: NominatimResult | null) => {
  if (!data) return null;
  const address = data.address ?? {};
  const road =
    address.road ??
    address.pedestrian ??
    address.footway ??
    address.cycleway ??
    address.path ??
    address.square ??
    address.place ??
    address.suburb ??
    address.neighbourhood ??
    address.quarter ??
    address.village ??
    address.town ??
    address.city;
  if (road) {
    const houseNumber = address.house_number;
    return houseNumber ? `${road} ${houseNumber}` : road;
  }
  if (data.display_name) {
    return data.display_name.split(",")[0]?.trim() ?? null;
  }
  return null;
};

const buildCity = (data?: NominatimResult | null) => {
  if (!data) return null;
  const address = data.address ?? {};
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    null
  );
};

const ensureAddress = async (
  poi: { lat: number; lon: number; address?: string; name: string; city?: string },
  fallbackCity?: string
) => {
  if (poi.address && poi.address.trim().length > 0) return poi.address.trim();
  const reverse = await reverseGeocode(poi.lat, poi.lon);
  const resolved = buildAddress(reverse);
  if (resolved) return resolved;
  return fallbackCity ?? poi.city ?? poi.name;
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

const isDuplicate = (
  candidate: Poi,
  existing: Poi[],
  normalizedNames: Set<string>
) => {
  const normalized = normalizeName(candidate.name);
  if (normalizedNames.has(normalized)) return true;
  for (const poi of existing) {
    if (poi.category !== candidate.category) continue;
    const distance = haversineKm(
      { lat: poi.lat, lon: poi.lon },
      { lat: candidate.lat, lon: candidate.lon }
    );
    if (distance < DEDUPE_DISTANCE_KM) return true;
  }
  return false;
};

const BEST_OF_SWITZERLAND: Array<{
  name: string;
  category: Poi["category"];
  city: string;
  query?: string;
}> = [
  { name: "St. Moritz", category: "landmarks", city: "St. Moritz" },
  {
    name: "Lake St. Moritz",
    category: "nature",
    city: "St. Moritz",
    query: "Lej da San Murezzan, St. Moritz, Switzerland",
  },
  {
    name: "Muottas Muragl",
    category: "nature",
    city: "Pontresina",
    query: "Muottas Muragl, Switzerland",
  },
  { name: "Corviglia", category: "nature", city: "St. Moritz" },
  {
    name: "Lake Silvaplana",
    category: "nature",
    city: "Silvaplana",
    query: "Lej da Silvaplauna, Silvaplana, Switzerland",
  },
  { name: "Sils im Engadin", category: "landmarks", city: "Sils im Engadin" },
  {
    name: "Swiss National Park",
    category: "nature",
    city: "Zernez",
    query: "Parc Naziunal Svizzer, Zernez, Switzerland",
  },
  {
    name: "Landwasser Viaduct",
    category: "landmarks",
    city: "Filisur",
    query: "Landwasserviadukt, Filisur, Switzerland",
  },
  { name: "Arosa", category: "nature", city: "Arosa" },
  {
    name: "Chur Old Town",
    category: "landmarks",
    city: "Chur",
    query: "Altstadt Chur, Chur, Switzerland",
  },
  { name: "Zermatt", category: "landmarks", city: "Zermatt" },
  { name: "Gornergrat", category: "nature", city: "Zermatt" },
  {
    name: "Matterhorn Glacier Paradise",
    category: "nature",
    city: "Zermatt",
  },
  { name: "Saas-Fee", category: "nature", city: "Saas-Fee" },
  {
    name: "Aletsch Glacier",
    category: "nature",
    city: "Fiesch",
    query: "Great Aletsch Glacier, Switzerland",
  },
  { name: "Verbier", category: "nature", city: "Verbier" },
  { name: "Crans-Montana", category: "nature", city: "Crans-Montana" },
  {
    name: "Leukerbad Thermal Baths",
    category: "other",
    city: "Leukerbad",
    query: "Leukerbad Therme, Leukerbad, Switzerland",
  },
  { name: "Grindelwald", category: "nature", city: "Grindelwald" },
  { name: "First Cliff Walk", category: "landmarks", city: "Grindelwald" },
  { name: "Bachalpsee", category: "nature", city: "Grindelwald" },
  {
    name: "Lauterbrunnen Valley",
    category: "nature",
    city: "Lauterbrunnen",
    query: "Lauterbrunnen, Switzerland",
  },
  {
    name: "Staubbach Falls",
    category: "nature",
    city: "Lauterbrunnen",
    query: "Staubbachfall, Lauterbrunnen, Switzerland",
  },
  {
    name: "Trummelbach Falls",
    category: "nature",
    city: "Lauterbrunnen",
    query: "Tr\u00fcmmelbachf\u00e4lle, Lauterbrunnen, Switzerland",
  },
  { name: "M\u00fcrren", category: "other", city: "M\u00fcrren" },
  { name: "Schilthorn", category: "nature", city: "M\u00fcrren" },
  { name: "Wengen", category: "other", city: "Wengen" },
  { name: "Harder Kulm", category: "nature", city: "Interlaken" },
  {
    name: "Lake Brienz",
    category: "nature",
    city: "Brienz",
    query: "Brienzersee, Brienz, Switzerland",
  },
  {
    name: "Lake Thun",
    category: "nature",
    city: "Thun",
    query: "Thunersee, Switzerland",
  },
  { name: "Spiez Castle", category: "landmarks", city: "Spiez" },
  {
    name: "Mount Rigi",
    category: "nature",
    city: "Vitznau",
    query: "Rigi Kulm, Switzerland",
  },
  {
    name: "Mount Titlis",
    category: "nature",
    city: "Engelberg",
    query: "Titlis, Engelberg, Switzerland",
  },
  { name: "Stanserhorn", category: "nature", city: "Stans" },
  { name: "Lake Lucerne", category: "nature", city: "Luzern" },
  { name: "Lion Monument", category: "landmarks", city: "Luzern" },
  {
    name: "Swiss Museum of Transport",
    category: "museums",
    city: "Luzern",
  },
  { name: "Engelberg", category: "other", city: "Engelberg" },
  { name: "Stoos", category: "nature", city: "Stoos" },
  { name: "Parco Ciani", category: "nature", city: "Lugano" },
  { name: "Monte Br\u00e8", category: "nature", city: "Lugano" },
  { name: "Monte San Salvatore", category: "nature", city: "Lugano" },
  { name: "Locarno", category: "other", city: "Locarno" },
  { name: "Ascona", category: "other", city: "Ascona" },
  {
    name: "Brissago Islands",
    category: "nature",
    city: "Brissago",
    query: "Isole di Brissago, Brissago, Switzerland",
  },
  { name: "Verzasca Valley", category: "nature", city: "Verzasca" },
  { name: "Ponte dei Salti", category: "landmarks", city: "Lavertezzo" },
  {
    name: "Bellinzona Castelgrande",
    category: "landmarks",
    city: "Bellinzona",
    query: "Castelgrande, Bellinzona, Switzerland",
  },
  {
    name: "LAC Lugano Arte e Cultura",
    category: "museums",
    city: "Lugano",
  },
  { name: "Lake Lugano", category: "nature", city: "Lugano" },
  { name: "Montreux", category: "other", city: "Montreux" },
  { name: "Lavaux Vineyards", category: "landmarks", city: "Lavaux" },
  {
    name: "Lausanne Olympic Museum",
    category: "museums",
    city: "Lausanne",
    query: "The Olympic Museum, Lausanne, Switzerland",
  },
  { name: "Jet d'Eau", category: "landmarks", city: "Gen\u00e8ve" },
  { name: "Gruy\u00e8res Castle", category: "landmarks", city: "Gruy\u00e8res" },
  {
    name: "Cailler Chocolate Factory",
    category: "food",
    city: "Broc",
    query: "Maison Cailler, Broc, Switzerland",
  },
  { name: "Creux du Van", category: "nature", city: "Noiraigue" },
  {
    name: "Lausanne Cathedral",
    category: "landmarks",
    city: "Lausanne",
    query: "Cathedrale de Lausanne, Lausanne, Switzerland",
  },
  { name: "CERN", category: "other", city: "Meyrin" },
  { name: "Glacier 3000", category: "nature", city: "Les Diablerets" },
  {
    name: "Bern Zytglogge",
    category: "landmarks",
    city: "Bern",
    query: "Zytglogge, Bern, Switzerland",
  },
  { name: "Bundeshaus", category: "landmarks", city: "Bern" },
  { name: "Bern Bear Park", category: "nature", city: "Bern" },
  {
    name: "Basel Minster",
    category: "landmarks",
    city: "Basel",
    query: "Basler Munster, Basel, Switzerland",
  },
  { name: "Fondation Beyeler", category: "museums", city: "Riehen" },
  { name: "Tinguely Museum", category: "museums", city: "Basel" },
  {
    name: "Basel Old Town",
    category: "landmarks",
    city: "Basel",
    query: "Altstadt Basel, Basel, Switzerland",
  },
  {
    name: "St. Gallen Abbey",
    category: "landmarks",
    city: "St. Gallen",
    query: "Stiftsbezirk St. Gallen, St. Gallen, Switzerland",
  },
  { name: "Appenzell Village", category: "other", city: "Appenzell" },
  {
    name: "Fribourg Old Town",
    category: "landmarks",
    city: "Fribourg",
    query: "Altstadt Fribourg, Fribourg, Switzerland",
  },
  { name: "Neuch\u00e2tel Castle", category: "landmarks", city: "Neuch\u00e2tel" },
  {
    name: "Geneva Old Town",
    category: "landmarks",
    city: "Gen\u00e8ve",
    query: "Vieille Ville, Geneve, Switzerland",
  },
  {
    name: "Patek Philippe Museum",
    category: "museums",
    city: "Gen\u00e8ve",
  },
];

const main = async () => {
  const chData = (await fs.readFile(CH_PATH, "utf8")) as string;
  const zhData = (await fs.readFile(ZURICH_PATH, "utf8")) as string;
  const chPois = JSON.parse(chData) as Poi[];
  const zurichPois = JSON.parse(zhData) as RawPoi[];

  const usedIds = new Set(chPois.map((poi) => poi.id));
  const normalizedNames = new Set(chPois.map((poi) => normalizeName(poi.name)));

  const output: Poi[] = [...chPois];
  const initialCount = output.length;
  let addedCount = 0;
  let dedupedCount = 0;

  for (const poi of zurichPois) {
    const candidateBase: Poi = {
      id: poi.id,
      name: poi.name,
      category: poi.category,
      lat: poi.lat,
      lon: poi.lon,
      source: "static",
      countryCode: "CH",
    };

    if (isDuplicate(candidateBase, output, normalizedNames)) {
      dedupedCount += 1;
      continue;
    }

    const resolvedAddress = await ensureAddress(
      { lat: poi.lat, lon: poi.lon, address: poi.address, name: poi.name },
      ZURICH_CITY
    );
    const candidate: Poi = {
      ...candidateBase,
      id: buildUniqueId(
        `country-ch-zurich-${slugify(poi.name)}`,
        usedIds
      ),
      address: resolvedAddress,
      city: ZURICH_CITY,
    };

    output.push(candidate);
    normalizedNames.add(normalizeName(candidate.name));
    addedCount += 1;
  }

  for (const candidate of BEST_OF_SWITZERLAND) {
    const normalized = normalizeName(candidate.name);
    if (normalizedNames.has(normalized)) {
      dedupedCount += 1;
      continue;
    }

    const query = candidate.query ?? `${candidate.name}, ${candidate.city}, Switzerland`;
    const geo = await searchGeocode(query);
    if (!geo || !geo.lat || !geo.lon) {
      console.warn(`Skipping "${candidate.name}" (no geocode result).`);
      continue;
    }

    const lat = Number(geo.lat);
    const lon = Number(geo.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.warn(`Skipping "${candidate.name}" (invalid coordinates).`);
      continue;
    }

    const resolvedAddress = buildAddress(geo) ?? candidate.city ?? candidate.name;
    const city = candidate.city || buildCity(geo) || "Switzerland";

    const base = `country-ch-${slugify(candidate.name)}`;
    const id = usedIds.has(base)
      ? buildUniqueId(
          `country-ch-${slugify(candidate.name)}-${slugify(candidate.city)}`,
          usedIds
        )
      : buildUniqueId(base, usedIds);

    const next: Poi = {
      id,
      name: candidate.name,
      category: candidate.category,
      lat,
      lon,
      source: "static",
      countryCode: "CH",
      address: resolvedAddress,
      city,
    };

    if (isDuplicate(next, output, normalizedNames)) {
      dedupedCount += 1;
      continue;
    }

    output.push(next);
    normalizedNames.add(normalizeName(next.name));
    addedCount += 1;
  }

  await fs.writeFile(CH_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log("Swiss POI merge complete:");
  console.log(`- CH before: ${initialCount}`);
  console.log(`- Zurich source: ${zurichPois.length}`);
  console.log(`- Added: ${addedCount}`);
  console.log(`- Deduped/skipped: ${dedupedCount}`);
};

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
