import type { Country, Coordinates } from "@/lib/types";
import baseMeta from "@/lib/data/countries/countries.meta.json";

type CountryMetaEntry = {
  code: string;
  code3?: string | null;
  name: string;
  capital: string;
  population: number;
  lat: number;
  lon: number;
  topCities: NonNullable<Country["topCities"]>;
};

const curatedOverrides: Country[] = [
  {
    code: "DE",
    name: "Germany",
    capital: "Berlin",
    lat: 52.52,
    lon: 13.405,
    population: 83200000,
    topCities: [
      { name: "Munich", lat: 48.1351, lon: 11.582 },
      { name: "Hamburg", lat: 53.5511, lon: 9.9937 },
      { name: "Cologne", lat: 50.9375, lon: 6.9603 },
    ],
    topPlaces: [
      { name: "Brandenburg Gate", category: "landmarks" },
      { name: "Neuschwanstein Castle", category: "landmarks" },
      { name: "Black Forest", category: "nature" },
    ],
  },
  {
    code: "JP",
    name: "Japan",
    capital: "Tokyo",
    lat: 35.6895,
    lon: 139.6917,
    population: 125000000,
    topCities: [
      { name: "Kyoto", lat: 35.0116, lon: 135.7681 },
      { name: "Osaka", lat: 34.6937, lon: 135.5023 },
      { name: "Sapporo", lat: 43.0618, lon: 141.3545 },
    ],
    topPlaces: [
      { name: "Fushimi Inari", category: "landmarks" },
      { name: "Mount Fuji", category: "nature" },
      { name: "Shibuya Crossing", category: "landmarks" },
    ],
  },
  {
    code: "BR",
    name: "Brazil",
    capital: "Brasilia",
    lat: -15.7939,
    lon: -47.8828,
    population: 215000000,
    topCities: [
      { name: "Rio de Janeiro", lat: -22.9068, lon: -43.1729 },
      { name: "Sao Paulo", lat: -23.5558, lon: -46.6396 },
      { name: "Salvador", lat: -12.9777, lon: -38.5016 },
    ],
    topPlaces: [
      { name: "Christ the Redeemer", category: "landmarks" },
      { name: "Iguazu Falls", category: "nature" },
      { name: "Amazon Theatre", category: "landmarks" },
    ],
  },
  {
    code: "US",
    name: "United States",
    capital: "Washington, D.C.",
    lat: 38.9072,
    lon: -77.0369,
    population: 334000000,
    topCities: [
      { name: "New York", lat: 40.7128, lon: -74.006 },
      { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
      { name: "Chicago", lat: 41.8781, lon: -87.6298 },
    ],
    topPlaces: [
      { name: "Grand Canyon", category: "nature" },
      { name: "Statue of Liberty", category: "landmarks" },
      { name: "Golden Gate Bridge", category: "landmarks" },
    ],
  },
  {
    code: "FR",
    name: "France",
    capital: "Paris",
    lat: 48.8566,
    lon: 2.3522,
    population: 68000000,
    topCities: [
      { name: "Lyon", lat: 45.764, lon: 4.8357 },
      { name: "Marseille", lat: 43.2965, lon: 5.3698 },
      { name: "Nice", lat: 43.7102, lon: 7.262 },
    ],
    topPlaces: [
      { name: "Eiffel Tower", category: "landmarks" },
      { name: "Louvre Museum", category: "museums" },
      { name: "French Riviera", category: "nature" },
    ],
  },
  {
    code: "ZA",
    name: "South Africa",
    capital: "Pretoria",
    lat: -25.7479,
    lon: 28.2293,
    population: 60000000,
    topCities: [
      { name: "Cape Town", lat: -33.9249, lon: 18.4241 },
      { name: "Johannesburg", lat: -26.2041, lon: 28.0473 },
      { name: "Durban", lat: -29.8587, lon: 31.0218 },
    ],
    topPlaces: [
      { name: "Table Mountain", category: "nature" },
      { name: "Kruger Park", category: "nature" },
      { name: "V&A Waterfront", category: "landmarks" },
    ],
  },
  {
    code: "AU",
    name: "Australia",
    capital: "Canberra",
    lat: -35.2809,
    lon: 149.13,
    population: 26000000,
    topCities: [
      { name: "Sydney", lat: -33.8688, lon: 151.2093 },
      { name: "Melbourne", lat: -37.8136, lon: 144.9631 },
      { name: "Brisbane", lat: -27.4698, lon: 153.0251 },
    ],
    topPlaces: [
      { name: "Sydney Opera House", category: "landmarks" },
      { name: "Great Barrier Reef", category: "nature" },
      { name: "Bondi Beach", category: "nature" },
    ],
  },
  {
    code: "IN",
    name: "India",
    capital: "New Delhi",
    lat: 28.6139,
    lon: 77.209,
    population: 1400000000,
    topCities: [
      { name: "Mumbai", lat: 19.076, lon: 72.8777 },
      { name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
      { name: "Jaipur", lat: 26.9124, lon: 75.7873 },
    ],
    topPlaces: [
      { name: "Taj Mahal", category: "landmarks" },
      { name: "Amber Fort", category: "landmarks" },
      { name: "Goa Beaches", category: "nature" },
    ],
  },
];

const curatedByCode = Object.fromEntries(
  curatedOverrides.map((entry) => [entry.code.toUpperCase(), entry])
) as Record<string, Country>;

const baseEntries = Object.values(baseMeta) as CountryMetaEntry[];

export const countryMeta: Country[] = baseEntries.map((entry) => {
  const override = curatedByCode[entry.code.toUpperCase()];
  return {
    code: entry.code,
    name: override?.name ?? entry.name,
    capital: override?.capital ?? entry.capital,
    lat: override?.lat ?? entry.lat,
    lon: override?.lon ?? entry.lon,
    population: override?.population ?? entry.population,
    topCities: override?.topCities ?? entry.topCities,
    topPlaces: override?.topPlaces,
  };
});

export const countryMetaByCode = Object.fromEntries(
  countryMeta.map((country) => [country.code.toUpperCase(), country])
) as Record<string, Country>;

const countryMetaByCode3 = Object.fromEntries(
  baseEntries
    .filter((entry) => entry.code3)
    .map((entry) => [
      String(entry.code3).toUpperCase(),
      countryMetaByCode[entry.code.toUpperCase()],
    ])
) as Record<string, Country>;

const countryMetaByName = Object.fromEntries(
  countryMeta.map((country) => [country.name.toLowerCase(), country])
) as Record<string, Country>;

export const getCountryMeta = (code: string) => {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;
  return (
    countryMetaByCode[normalized] ??
    countryMetaByCode3[normalized] ??
    null
  );
};

export const getCountryMetaByName = (name: string) => {
  const key = name?.trim().toLowerCase();
  if (!key) return null;
  return countryMetaByName[key] ?? null;
};

export const resolveCountryCode = (value: string) =>
  getCountryMeta(value)?.code ?? getCountryMetaByName(value)?.code ?? null;

export const loadCountryMeta = getCountryMeta;

const isValidLatLon = (lat?: number, lon?: number) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (Math.abs(lat as number) > 90 || Math.abs(lon as number) > 180) {
    return false;
  }
  return true;
};

const isZeroCenter = (lat: number, lon: number) =>
  Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001;

export const getCapitalCoordinates = (
  country?: Country | null
): Coordinates | null => {
  if (!country?.capital || !country.topCities?.length) return null;
  const capitalName = country.capital.trim().toLowerCase();
  const capital = country.topCities.find(
    (city) => city.name.trim().toLowerCase() === capitalName
  );
  if (!capital) return null;
  if (!isValidLatLon(capital.lat, capital.lon)) return null;
  if (isZeroCenter(capital.lat, capital.lon)) return null;
  return { lat: capital.lat, lon: capital.lon };
};

export const resolveCountryCenterFromMeta = (
  country?: Country | null
): Coordinates | null => {
  if (!country) return null;
  if (isValidLatLon(country.lat, country.lon) && !isZeroCenter(country.lat, country.lon)) {
    return { lat: country.lat, lon: country.lon };
  }
  return getCapitalCoordinates(country);
};
