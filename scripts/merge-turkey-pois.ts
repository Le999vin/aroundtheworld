// Usage: node scripts/merge-turkey-pois.ts
const fs = require("node:fs/promises");
const path = require("node:path");

type Poi = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  source: "static";
  countryCode: "TR";
  address: string;
  city: string;
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
const TR_PATH = path.join(
  ROOT,
  "src",
  "lib",
  "data",
  "pois",
  "datasets",
  "countries",
  "TR.json"
);
const ISTANBUL_PATH = path.join(
  ROOT,
  "src",
  "lib",
  "data",
  "pois",
  "datasets",
  "cities",
  "istanbul.json"
);

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ??
  "GlobalTravelAtlas/1.0 (contact: https://example.com)";
const RATE_LIMIT_MS = 1100;
const DEDUPE_DISTANCE_KM = 0.15;
const ISTANBUL_CITY = "Istanbul";
const ISTANBUL_ALIASES = new Set(["istanbul", "beyoglu", "uskudar", "kadikoy"]);

const searchCache = new Map<string, NominatimResult | null>();
const reverseCache = new Map<string, NominatimResult | null>();

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
      "Accept-Language": "tr,en",
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
  url.searchParams.set("countrycodes", "tr");
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
    .replace(/\u0131/g, "i")
    .replace(/\u0130/g, "i")
    .replace(/\u015f/g, "s")
    .replace(/\u015e/g, "s")
    .replace(/\u011f/g, "g")
    .replace(/\u011e/g, "g")
    .replace(/\u00f6/g, "o")
    .replace(/\u00d6/g, "o")
    .replace(/\u00fc/g, "u")
    .replace(/\u00dc/g, "u")
    .replace(/\u00e7/g, "c")
    .replace(/\u00c7/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeCityName = (value: string) => {
  const normalized = normalizeName(value);
  if (ISTANBUL_ALIASES.has(normalized)) return ISTANBUL_CITY;
  return value;
};

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
  candidate: { name: string; lat: number; lon: number; category: string; city?: string },
  existing: Poi[],
  normalizedNames: Set<string>
) => {
  const normalized = normalizeName(candidate.name);
  if (normalizedNames.has(normalized)) {
    const sameCity = existing.some(
      (poi) =>
        normalizeName(poi.name) === normalized &&
        poi.city &&
        candidate.city &&
        normalizeName(poi.city) === normalizeName(candidate.city)
    );
    if (sameCity) return true;
  }

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

const BEST_OF_TURKEY: Array<{
  name: string;
  category: Poi["category"];
  city: string;
  query?: string;
}> = [
  { name: "Dolmabahce Palace", category: "landmarks", city: "Istanbul" },
  { name: "Basilica Cistern", category: "landmarks", city: "Istanbul" },
  { name: "Suleymaniye Mosque", category: "landmarks", city: "Istanbul" },
  { name: "Spice Bazaar", category: "food", city: "Istanbul" },
  { name: "Kadikoy Market", category: "food", city: "Istanbul" },
  { name: "Balat", category: "other", city: "Istanbul" },
  { name: "Ortakoy Square", category: "other", city: "Istanbul" },
  { name: "Maiden's Tower", category: "landmarks", city: "Istanbul" },
  { name: "Princes' Islands", category: "nature", city: "Istanbul" },
  { name: "Istanbul Modern", category: "museums", city: "Istanbul" },
  { name: "Pera Museum", category: "museums", city: "Istanbul" },
  { name: "Rahmi M. Koc Museum", category: "museums", city: "Istanbul" },
  { name: "Pierre Loti Hill", category: "nature", city: "Istanbul" },
  { name: "Emirgan Park", category: "nature", city: "Istanbul" },
  { name: "Moda Coast", category: "nature", city: "Istanbul" },
  { name: "Galataport Istanbul", category: "other", city: "Istanbul" },
  { name: "Ankara Castle", category: "landmarks", city: "Ankara" },
  { name: "Museum of Anatolian Civilizations", category: "museums", city: "Ankara" },
  { name: "Kizilay Square", category: "other", city: "Ankara" },
  { name: "Ataturk Forest Farm", category: "nature", city: "Ankara" },
  { name: "Konak Square", category: "landmarks", city: "Izmir" },
  { name: "Kemeralt\u0131 Bazaar", category: "food", city: "Izmir" },
  { name: "Alsancak", category: "nightlife", city: "Izmir" },
  { name: "Izmir Clock Tower", category: "landmarks", city: "Izmir" },
  { name: "Agora of Smyrna", category: "landmarks", city: "Izmir" },
  { name: "Izmir Archaeological Museum", category: "museums", city: "Izmir" },
  { name: "Duden Waterfalls", category: "nature", city: "Antalya" },
  { name: "Konyaalti Beach", category: "nature", city: "Antalya" },
  { name: "Lara Beach", category: "nature", city: "Antalya" },
  { name: "Antalya Museum", category: "museums", city: "Antalya" },
  { name: "Hadrian's Gate", category: "landmarks", city: "Antalya" },
  { name: "Perge Ancient City", category: "landmarks", city: "Antalya" },
  { name: "Aspendos Theatre", category: "landmarks", city: "Serik" },
  { name: "Side Ancient City", category: "landmarks", city: "Manavgat" },
  { name: "Alanya Castle", category: "landmarks", city: "Alanya" },
  { name: "Olympos", category: "nature", city: "Kumluca" },
  { name: "Cirali Beach", category: "nature", city: "Kumluca" },
  { name: "Goreme Open Air Museum", category: "museums", city: "Goreme" },
  { name: "Uchisar Castle", category: "landmarks", city: "Uchisar" },
  { name: "Pigeon Valley", category: "nature", city: "Goreme" },
  { name: "Love Valley", category: "nature", city: "Goreme" },
  { name: "Pasabag", category: "landmarks", city: "Goreme" },
  { name: "Devrent Valley", category: "nature", city: "Urgup" },
  { name: "Derinkuyu Underground City", category: "landmarks", city: "Derinkuyu" },
  { name: "Kaymakli Underground City", category: "landmarks", city: "Kaymakli" },
  { name: "Avanos", category: "other", city: "Avanos" },
  { name: "Red Valley", category: "nature", city: "Urgup" },
  { name: "Hierapolis", category: "landmarks", city: "Pamukkale" },
  { name: "Pamukkale Travertines", category: "nature", city: "Pamukkale" },
  { name: "Temple of Artemis", category: "landmarks", city: "Selcuk" },
  { name: "House of Virgin Mary", category: "landmarks", city: "Selcuk" },
  { name: "Sirince Village", category: "other", city: "Selcuk" },
  { name: "Selcuk Castle", category: "landmarks", city: "Selcuk" },
  { name: "Bodrum Castle", category: "landmarks", city: "Bodrum" },
  { name: "Mausoleum at Halicarnassus", category: "landmarks", city: "Bodrum" },
  { name: "Bodrum Amphitheatre", category: "landmarks", city: "Bodrum" },
  { name: "Gumusluk", category: "other", city: "Bodrum" },
  { name: "Bodrum Bar Street", category: "nightlife", city: "Bodrum" },
  { name: "Marmaris Marina", category: "landmarks", city: "Marmaris" },
  { name: "Icmeler Beach", category: "nature", city: "Marmaris" },
  { name: "Turunc", category: "nature", city: "Marmaris" },
  { name: "Marmaris Castle", category: "landmarks", city: "Marmaris" },
  { name: "Oludeniz Lagoon", category: "nature", city: "Fethiye" },
  { name: "Butterfly Valley", category: "nature", city: "Fethiye" },
  { name: "Kayakoy Ghost Town", category: "landmarks", city: "Fethiye" },
  { name: "Saklikent Gorge", category: "nature", city: "Fethiye" },
  { name: "Calis Beach", category: "nature", city: "Fethiye" },
  { name: "Fethiye Fish Market", category: "food", city: "Fethiye" },
  { name: "Fethiye Marina", category: "landmarks", city: "Fethiye" },
  { name: "Kaputas Beach", category: "nature", city: "Kas" },
  { name: "Patara Beach", category: "nature", city: "Kas" },
  { name: "Antiphellos Ancient Theater", category: "landmarks", city: "Kas" },
  { name: "Mevlana Museum", category: "museums", city: "Konya" },
  { name: "Alaaddin Hill", category: "nature", city: "Konya" },
  { name: "Sille Village", category: "other", city: "Konya" },
  { name: "Uludag", category: "nature", city: "Bursa" },
  { name: "Cumalikizik Village", category: "other", city: "Bursa" },
  { name: "Green Mosque", category: "landmarks", city: "Bursa" },
  { name: "Kozahan Bazaar", category: "food", city: "Bursa" },
  { name: "Trabzon Hagia Sophia", category: "landmarks", city: "Trabzon" },
  { name: "Uzungol", category: "nature", city: "Trabzon" },
  { name: "Ataturk Mansion", category: "museums", city: "Trabzon" },
  { name: "Sera Lake", category: "nature", city: "Trabzon" },
  { name: "Boztepe", category: "nature", city: "Trabzon" },
  { name: "Ayder Plateau", category: "nature", city: "Rize" },
  { name: "Firtina Valley", category: "nature", city: "Rize" },
  { name: "Zil Kale", category: "landmarks", city: "Rize" },
  { name: "Pokut Plateau", category: "nature", city: "Rize" },
  { name: "Rize Tea Gardens", category: "other", city: "Rize" },
  { name: "Camlihemsin", category: "other", city: "Rize" },
  { name: "Safranbolu Old Town", category: "landmarks", city: "Safranbolu" },
  { name: "Amasra", category: "landmarks", city: "Amasra" },
  { name: "Sinop Inceburun Lighthouse", category: "landmarks", city: "Sinop" },
  { name: "Amasya Castle", category: "landmarks", city: "Amasya" },
  { name: "Ordu Boztepe", category: "nature", city: "Ordu" },
  { name: "Giresun Island", category: "nature", city: "Giresun" },
  { name: "Lake Van", category: "nature", city: "Van" },
  { name: "Akdamar Island", category: "landmarks", city: "Van" },
  { name: "Van Castle", category: "landmarks", city: "Van" },
  { name: "Ani Ruins", category: "landmarks", city: "Kars" },
  { name: "Mount Ararat", category: "nature", city: "Agri" },
  { name: "Ishak Pasha Palace", category: "landmarks", city: "Dogubayazit" },
  { name: "Nemrut Crater Lake", category: "nature", city: "Tatvan" },
  { name: "Palandoken Ski Center", category: "nature", city: "Erzurum" },
  { name: "Tortum Waterfall", category: "nature", city: "Erzurum" },
  { name: "Dara Ancient City", category: "landmarks", city: "Mardin" },
  { name: "Hasankeyf", category: "landmarks", city: "Batman" },
  { name: "Zeugma Mosaic Museum", category: "museums", city: "Gaziantep" },
  { name: "Gaziantep Castle", category: "landmarks", city: "Gaziantep" },
  { name: "Halfeti", category: "other", city: "Sanliurfa" },
  { name: "Balikligol", category: "landmarks", city: "Sanliurfa" },
  { name: "Gobekli Tepe", category: "landmarks", city: "Sanliurfa" },
  { name: "Harran", category: "landmarks", city: "Sanliurfa" },
  { name: "Pergamon Acropolis", category: "landmarks", city: "Bergama" },
  { name: "Pergamon Asclepieion", category: "landmarks", city: "Bergama" },
  { name: "Troy", category: "landmarks", city: "Canakkale" },
  { name: "Assos Ancient City", category: "landmarks", city: "Ayvacik" },
  { name: "Didyma Temple of Apollo", category: "landmarks", city: "Didim" },
  { name: "Kusadasi", category: "other", city: "Kusadasi" },
  { name: "Cesme Castle", category: "landmarks", city: "Cesme" },
  { name: "Bozcaada", category: "other", city: "Bozcaada" },
  { name: "Eskisehir Odunpazari", category: "other", city: "Eskisehir" },
  { name: "Erciyes Mountain", category: "nature", city: "Kayseri" },
  { name: "Kizkalesi", category: "landmarks", city: "Mersin" },
  { name: "Adana Stone Bridge", category: "landmarks", city: "Adana" },
  { name: "Tarsus", category: "other", city: "Tarsus" },
  { name: "Hatay Archaeology Museum", category: "museums", city: "Antakya" },
];

const main = async () => {
  const trData = (await fs.readFile(TR_PATH, "utf8")) as string;
  const istanbulData = (await fs.readFile(ISTANBUL_PATH, "utf8")) as string;

  const trPois = JSON.parse(trData) as RawPoi[];
  const istanbulPois = JSON.parse(istanbulData) as RawPoi[];

  const output: Poi[] = [];
  const usedIds = new Set<string>();
  const normalizedNames = new Set<string>();

  for (const poi of trPois) {
    const normalized = normalizeName(poi.name);
    normalizedNames.add(normalized);
    usedIds.add(poi.id);

    let address = (poi.address ?? "").toString();
    let city = (poi.city ?? "").toString();

    if (!address.trim() || !city.trim()) {
      const reverse = await reverseGeocode(poi.lat, poi.lon);
      if (!address.trim()) {
        address = buildAddress(reverse) ?? "";
      }
      if (!city.trim()) {
        city = buildCity(reverse) ?? "";
      }
    }

    output.push({
      id: poi.id,
      name: poi.name,
      category: poi.category,
      lat: poi.lat,
      lon: poi.lon,
      source: "static",
      countryCode: "TR",
      address: address.trim(),
      city: normalizeCityName(city.trim()),
    });
  }

  const initialCount = output.length;
  let addedCount = 0;
  let dedupedCount = 0;

  for (const poi of istanbulPois) {
    const candidateBase = {
      name: poi.name,
      category: poi.category,
      lat: poi.lat,
      lon: poi.lon,
      city: ISTANBUL_CITY,
    };

    if (isDuplicate(candidateBase, output, normalizedNames)) {
      dedupedCount += 1;
      continue;
    }

    const address = (poi.address ?? "").toString();
    const candidate: Poi = {
      id: buildUniqueId(
        `country-tr-istanbul-${slugify(poi.name)}`,
        usedIds
      ),
      name: poi.name,
      category: poi.category,
      lat: poi.lat,
      lon: poi.lon,
      source: "static",
      countryCode: "TR",
      address: address.trim(),
      city: ISTANBUL_CITY,
    };

    output.push(candidate);
    normalizedNames.add(normalizeName(candidate.name));
    addedCount += 1;
  }

  for (const candidate of BEST_OF_TURKEY) {
    const normalized = normalizeName(candidate.name);
    if (normalizedNames.has(normalized)) {
      dedupedCount += 1;
      continue;
    }

    const query = candidate.query ?? `${candidate.name}, ${candidate.city}, Turkey`;
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

    const address = buildAddress(geo) ?? candidate.city ?? "";
    const city = normalizeCityName(candidate.city || buildCity(geo) || "");

    const base = `country-tr-${slugify(candidate.name)}`;
    const id = usedIds.has(base)
      ? buildUniqueId(
          `country-tr-${slugify(candidate.name)}-${slugify(candidate.city)}`,
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
      countryCode: "TR",
      address: address.trim(),
      city: city.trim(),
    };

    if (isDuplicate(next, output, normalizedNames)) {
      dedupedCount += 1;
      continue;
    }

    output.push(next);
    normalizedNames.add(normalizeName(next.name));
    addedCount += 1;
  }

  await fs.writeFile(TR_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log("Turkey POI merge complete:");
  console.log(`- TR before: ${initialCount}`);
  console.log(`- Istanbul source: ${istanbulPois.length}`);
  console.log(`- Added: ${addedCount}`);
  console.log(`- Deduped/skipped: ${dedupedCount}`);
};

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
