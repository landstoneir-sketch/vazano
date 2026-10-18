import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const IRAN_CITY_REFERENCE_COUNT = 1_481;
export const IRAN_PROVINCE_REFERENCE_COUNT = 31;

export type IranCityReference = {
  sourceCode: string;
  nameFa: string;
};

export type IranProvinceReference = {
  sourceCode: string;
  nameFa: string;
  cities: IranCityReference[];
};

export type IranCitiesReferenceData = {
  schemaVersion: number;
  provinceCount: number;
  cityCount: number;
  source: {
    commit: string;
    dataYearSolarHijri: number;
    license: string;
  };
  provinces: IranProvinceReference[];
};

export type CitySeedRow = {
  code: string;
  nameFa: string;
  sortOrder: number;
};

const CITY_NAME_DISAMBIGUATION: Readonly<Record<string, string>> = {
  '2390': 'گلوگاه (شهرستان بابل)',
  '1157': 'گلوگاه (شهرستان گلوگاه)',
  '2953': 'علی آباد (شهرستان جیرفت)',
  '1012': 'علی آباد (شهرستان ارزوییه)',
  '1008': 'کشکوییه (شهرستان بافت)',
  '2319': 'کشکوییه (شهرستان رفسنجان)',
};

export function normalizeIranianLocationName(value: string): string {
  return value
    .trim()
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/[\s\u200c\-()]/g, '');
}

export function loadIranCitiesReferenceData(
  path = join(__dirname, 'reference-data', 'iran-cities-1404.json'),
): IranCitiesReferenceData {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  assertReferenceData(parsed);
  return parsed;
}

export function buildProvinceCitySeedRows(
  reference: IranCitiesReferenceData,
  provinceNameFa: string,
  capitalNameFa: string,
): CitySeedRow[] {
  const province = reference.provinces.find((item) => item.nameFa === provinceNameFa);
  if (!province) throw new Error(`Iran city reference is missing province: ${provinceNameFa}`);

  const normalizedCapital = normalizeIranianLocationName(capitalNameFa);
  const capitalMatches = province.cities.filter(
    (city) => normalizeIranianLocationName(city.nameFa) === normalizedCapital,
  );
  if (capitalMatches.length !== 1) {
    throw new Error(`Iran city reference must contain one capital match for ${provinceNameFa}: ${capitalNameFa}`);
  }

  return province.cities
    .filter((city) => normalizeIranianLocationName(city.nameFa) !== normalizedCapital)
    .map((city, index) => ({
      code: `sci-${city.sourceCode}`,
      nameFa: CITY_NAME_DISAMBIGUATION[city.sourceCode] ?? city.nameFa,
      sortOrder: index + 2,
    }));
}

function assertReferenceData(value: unknown): asserts value is IranCitiesReferenceData {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error('Iran city reference schema version is invalid.');
  if (value.provinceCount !== IRAN_PROVINCE_REFERENCE_COUNT || value.cityCount !== IRAN_CITY_REFERENCE_COUNT) {
    throw new Error('Iran city reference declared counts are invalid.');
  }
  if (!isRecord(value.source)
    || typeof value.source.commit !== 'string'
    || typeof value.source.dataYearSolarHijri !== 'number'
    || typeof value.source.license !== 'string') {
    throw new Error('Iran city reference source metadata is invalid.');
  }
  if (!Array.isArray(value.provinces) || value.provinces.length !== IRAN_PROVINCE_REFERENCE_COUNT) {
    throw new Error('Iran city reference province list is incomplete.');
  }

  const provinceNames = new Set<string>();
  const cityCodes = new Set<string>();
  let cityCount = 0;
  for (const province of value.provinces) {
    if (!isRecord(province)
      || typeof province.sourceCode !== 'string'
      || !/^\d{2}$/.test(province.sourceCode)
      || typeof province.nameFa !== 'string'
      || province.nameFa.trim().length === 0
      || !Array.isArray(province.cities)) {
      throw new Error('Iran city reference contains an invalid province.');
    }
    if (provinceNames.has(province.nameFa)) throw new Error(`Duplicate province in Iran city reference: ${province.nameFa}`);
    provinceNames.add(province.nameFa);

    const cityNames = new Set<string>();
    for (const city of province.cities) {
      if (!isRecord(city)
        || typeof city.sourceCode !== 'string'
        || !/^\d{4}$/.test(city.sourceCode)
        || typeof city.nameFa !== 'string'
        || city.nameFa.trim().length === 0) {
        throw new Error(`Iran city reference contains an invalid city in ${province.nameFa}.`);
      }
      const displayName = CITY_NAME_DISAMBIGUATION[city.sourceCode] ?? city.nameFa;
      const normalizedName = normalizeIranianLocationName(displayName);
      if (cityNames.has(normalizedName)) throw new Error(`Duplicate city display name in ${province.nameFa}: ${displayName}`);
      if (cityCodes.has(city.sourceCode)) throw new Error(`Duplicate city source code: ${city.sourceCode}`);
      cityNames.add(normalizedName);
      cityCodes.add(city.sourceCode);
      cityCount += 1;
    }
  }
  if (cityCount !== IRAN_CITY_REFERENCE_COUNT) throw new Error(`Iran city reference contains ${cityCount} cities.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
