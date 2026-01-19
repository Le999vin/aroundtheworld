const fs = require("node:fs/promises");
const path = require("node:path");
const { poiSchema, formatIssuePath } = require("./poi-schema.ts");

const readJsonFile = async (filePath: string) => {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
};

const listJsonFiles = async (dir: string) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry: { isFile: () => boolean; name: string }) => entry.isFile())
    .map((entry: { name: string }) => entry.name)
    .filter((name: string) => name.toLowerCase().endsWith(".json"))
    .sort((a: string, b: string) => a.localeCompare(b));
};

const validateDataset = async (filePath: string) => {
  const data = await readJsonFile(filePath);
  if (!Array.isArray(data)) {
    console.error(`[pois] ${filePath} is not an array.`);
    return 1;
  }

  let errors = 0;

  data.forEach((entry, index) => {
    const parsed = poiSchema.safeParse(entry);
    if (parsed.success) return;
    errors += 1;
    for (const issue of parsed.error.issues) {
      const location = formatIssuePath([index, ...issue.path]);
      console.warn(`[pois] ${filePath} ${location}: ${issue.message}`);
    }
  });

  return errors;
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

  let totalErrors = 0;

  for (const file of countryFiles) {
    const filePath = path.join(countriesDir, file);
    totalErrors += await validateDataset(filePath);
  }

  for (const file of cityFiles) {
    const filePath = path.join(citiesDir, file);
    totalErrors += await validateDataset(filePath);
  }

  if (totalErrors > 0) {
    console.error(`[pois] Validation failed with ${totalErrors} errors.`);
    process.exit(1);
  }

  console.log("[pois] All POI datasets are valid.");
};

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
