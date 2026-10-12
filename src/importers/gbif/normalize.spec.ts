import {
  cleanDisplayName,
  elevationRange,
  normalizeText,
  splitVernacularNames,
  toIso1Language,
  toOpenLicense,
} from './normalize.js';

describe('normalizeText', () => {
  it('quita acentos, pasa a minúsculas y colapsa espacios', () => {
    expect(normalizeText('  Almácigo   NEGRO ')).toBe('almacigo negro');
    expect(normalizeText('Jiñocuabe')).toBe('jinocuabe');
  });
});

describe('cleanDisplayName', () => {
  it('limpia espacios y pone mayúscula inicial', () => {
    expect(cleanDisplayName('  frailejón  ')).toBe('Frailejón');
  });
});

describe('splitVernacularNames', () => {
  it('separa nombres agrupados y elimina repetidos y vacíos', () => {
    expect(
      splitVernacularNames(
        'Cascara sagrada | Indioencuero | resbala monos |  | indioencuero',
      ),
    ).toEqual(['Cascara sagrada', 'Indioencuero', 'Resbala monos']);
  });
});

describe('toOpenLicense', () => {
  it('acepta CC0 y CC-BY', () => {
    expect(
      toOpenLicense(
        'http://creativecommons.org/publicdomain/zero/1.0/legalcode',
      ),
    ).toBe('CC0-1.0');
    expect(
      toOpenLicense('http://creativecommons.org/licenses/by/4.0/legalcode'),
    ).toBe('CC-BY-4.0');
  });
  it('rechaza licencias no abiertas o ausentes', () => {
    expect(
      toOpenLicense('http://creativecommons.org/licenses/by-nc/4.0/legalcode'),
    ).toBeNull();
    expect(
      toOpenLicense('http://creativecommons.org/licenses/by-sa/4.0/legalcode'),
    ).toBeNull();
    expect(toOpenLicense(undefined)).toBeNull();
  });
});

describe('toIso1Language', () => {
  it('convierte ISO 639-3 a 639-1', () => {
    expect(toIso1Language('spa')).toBe('es');
    expect(toIso1Language('xyz')).toBeNull();
  });
});

describe('elevationRange', () => {
  it('calcula el rango central y descarta valores imposibles', () => {
    const values = [
      ...Array.from({ length: 98 }, (_, i) => 1000 + i * 10),
      99999,
      -9999,
    ];
    const range = elevationRange(values)!;
    expect(range.sampleSize).toBe(98);
    expect(range.minElevationM).toBeGreaterThanOrEqual(1000);
    expect(range.maxElevationM).toBeLessThanOrEqual(1980);
  });
  it('devuelve null si la muestra es pequeña', () => {
    expect(elevationRange([100, 200, 300])).toBeNull();
  });
});
