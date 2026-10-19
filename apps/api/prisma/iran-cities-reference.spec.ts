import {
  buildProvinceCitySeedRows,
  IRAN_CITY_REFERENCE_COUNT,
  IRAN_PROVINCE_REFERENCE_COUNT,
  loadIranCitiesReferenceData,
  normalizeIranianLocationName,
} from './iran-cities-reference';

describe('Iran cities reference data', () => {
  it('loads the approved nationwide reference with unique cities', () => {
    const reference = loadIranCitiesReferenceData();
    const sourceCodes = reference.provinces.flatMap((province) => province.cities.map((city) => city.sourceCode));

    expect(reference.provinces).toHaveLength(IRAN_PROVINCE_REFERENCE_COUNT);
    expect(sourceCodes).toHaveLength(IRAN_CITY_REFERENCE_COUNT);
    expect(new Set(sourceCodes).size).toBe(IRAN_CITY_REFERENCE_COUNT);
    expect(reference.source).toMatchObject({
      commit: '68687cf96cc1852d5d38c7283353c80829331758',
      dataYearSolarHijri: 1404,
      license: 'MIT',
    });
  });

  it('keeps the existing capital row while preparing every other city', () => {
    const reference = loadIranCitiesReferenceData();
    const lorestanRows = buildProvinceCitySeedRows(reference, 'لرستان', 'خرم‌آباد');
    const lorestanSource = reference.provinces.find((province) => province.nameFa === 'لرستان');

    expect(lorestanRows).toHaveLength((lorestanSource?.cities.length ?? 0) - 1);
    expect(lorestanRows.some((city) => normalizeIranianLocationName(city.nameFa) === 'خرمآباد')).toBe(false);
    expect(lorestanRows.every((city) => /^sci-\d{4}$/.test(city.code))).toBe(true);
  });

  it('keeps same-name cities distinguishable by their parent county', () => {
    const reference = loadIranCitiesReferenceData();
    const mazandaranRows = buildProvinceCitySeedRows(reference, 'مازندران', 'ساری');
    const kermanRows = buildProvinceCitySeedRows(reference, 'کرمان', 'کرمان');

    expect(mazandaranRows.filter((city) => city.nameFa.startsWith('گلوگاه (شهرستان'))).toHaveLength(2);
    expect(kermanRows.filter((city) => city.nameFa.startsWith('علی آباد (شهرستان'))).toHaveLength(2);
    expect(kermanRows.filter((city) => city.nameFa.startsWith('کشکوییه (شهرستان'))).toHaveLength(2);
  });

  it('normalizes common Persian location spelling variants', () => {
    expect(normalizeIranianLocationName('بندر عباس')).toBe(normalizeIranianLocationName('بندرعباس'));
    expect(normalizeIranianLocationName('خرم آباد')).toBe(normalizeIranianLocationName('خرم‌آباد'));
    expect(normalizeIranianLocationName('كاشان')).toBe(normalizeIranianLocationName('کاشان'));
  });
});
