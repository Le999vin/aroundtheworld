import fs from "node:fs/promises";
import path from "node:path";
import { sanitizePoi } from "../src/lib/data/pois/sanitize";
import {
  normalizeCountryCode,
  normalizeCityId,
  poiSchema,
  formatIssuePath,
} from "./poi-schema.ts";

const readJsonFile = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
};

const writeJsonFile = async (filePath: string, data: unknown) => {
  const output = JSON.stringify(data, null, 2) + "\n";
  await fs.writeFile(filePath, output, "utf8");
};

const listJsonFiles = async (dir: string) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry: { isFile: () => boolean; name: string }) => entry.isFile())
    .map((entry: { name: string }) => entry.name)
    .filter((name: string) => name.toLowerCase().endsWith(".json"))
    .sort((a: string, b: string) => a.localeCompare(b));
};

const inferCountryCode = (data: unknown[]) => {
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const raw = (entry as Record<string, unknown>).countryCode;
    if (typeof raw !== "string") continue;
    const normalized = normalizeCountryCode(raw);
    if (normalized) return normalized;
  }
  return undefined;
};

const fixDataset = async (filePath: string, kind: "countries" | "cities") => {
  const data = await readJsonFile(filePath);
  if (!Array.isArray(data)) {
    console.error(`[pois] ${filePath} is not an array.`);
    return { total: 0, fixedCity: 0, fixedAddress: 0, removedInvalid: 0, wrote: false };
  }

  const fileName = path.basename(filePath, ".json");
  const defaultCountryCode =
    kind === "countries" ? normalizeCountryCode(fileName) ?? undefined : inferCountryCode(data);
  const defaultCityId =
    kind === "cities" ? normalizeCityId(fileName) ?? undefined : undefined;

  const defaults = {
    defaultCountryCode,
    defaultCityId,
  };

  let fixedCity = 0;
  let fixedAddress = 0;
  let removedInvalid = 0;
  const sanitized: unknown[] = [];

  data.forEach((entry, index) => {
    const { poi, stats } = sanitizePoi(entry, defaults);
    if (stats.fixedCity) fixedCity += 1;
    if (stats.fixedAddress) fixedAddress += 1;

    if (!poi) {
      removedInvalid += 1;
      console.warn(
        `[pois] ${filePath} ${formatIssuePath([index])}: entry is not an object.`
      );
      return;
    }

    const parsed = poiSchema.safeParse(poi);
    if (!parsed.success) {
      removedInvalid += 1;
      for (const issue of parsed.error.issues) {
        const location = formatIssuePath([index, ...issue.path]);
        console.warn(
          `[pois] ${filePath} ${location}: ${issue.message}`
        );
      }
      return;
    }

    sanitized.push(parsed.data);
  });

  await writeJsonFile(filePath, sanitized);

  return {
    total: data.length,
    fixedCity,
    fixedAddress,
    removedInvalid,
    wrote: true,
  };
};

const run = async () => {
  const root = process.cwd();
  const datasetsRoot = path.join(root, "src", "lib", "data", "pois", "datasets");
  const countriesDir = path.join(datasetsRoot, "countries");
  const citiesDir = path.join(datasetsRoot, "cities");

  const [countryFiles, cityFiles] = await Promise.all([
    listJsonFiles(countriesDir),
    listJsonFiles(citiesDir),
  ]);

  let removedTotal = 0;

  for (const file of countryFiles) {
    const filePath = path.join(countriesDir, file);
    const result = await fixDataset(filePath, "countries");
    removedTotal += result.removedInvalid;
    console.log(
      `[pois] ${path.relative(root, filePath)} total=${result.total} fixedCity=${result.fixedCity} fixedAddress=${result.fixedAddress} removedInvalid=${result.removedInvalid}`
    );
  }

  for (const file of cityFiles) {
    const filePath = path.join(citiesDir, file);
    const result = await fixDataset(filePath, "cities");
    removedTotal += result.removedInvalid;
    console.log(
      `[pois] ${path.relative(root, filePath)} total=${result.total} fixedCity=${result.fixedCity} fixedAddress=${result.fixedAddress} removedInvalid=${result.removedInvalid}`
    );
  }

  if (removedTotal > 0) {
    process.exitCode = 1;
  }
};

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
