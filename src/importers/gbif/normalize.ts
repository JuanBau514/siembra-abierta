/** Normalización de datos de GBIF antes de guardarlos. Funciones puras, sin red ni base de datos. */

/** Minúsculas, sin acentos ni signos diacríticos y con espacios colapsados. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nombre para mostrar: sin espacios sobrantes y con la primera letra en mayúscula. */
export function cleanDisplayName(value: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.charAt(0).toLocaleUpperCase('es') + trimmed.slice(1);
}

/**
 * Algunas fuentes agrupan varios nombres en un solo campo ("A | B | C").
 * Devuelve cada nombre por separado, sin vacíos ni repetidos.
 */
export function splitVernacularNames(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[|;]/)) {
    const name = cleanDisplayName(part);
    const key = normalizeText(name);
    if (name.length < 2 || name.length > 120 || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export type OpenLicense = 'CC0-1.0' | 'CC-BY-4.0';

/**
 * Convierte la URL de licencia de GBIF en un código normalizado.
 * Devuelve null si la licencia NO es abierta (p. ej. CC-BY-NC): esos datos no se importan.
 */
export function toOpenLicense(
  licenseUrl: string | null | undefined,
): OpenLicense | null {
  if (!licenseUrl) return null;
  const url = licenseUrl.toLowerCase();
  if (url.includes('publicdomain/zero/1.0')) return 'CC0-1.0';
  if (/creativecommons\.org\/licenses\/by\/4\.0/.test(url)) return 'CC-BY-4.0';
  return null;
}

const LANGUAGE_ISO3_TO_ISO1: Record<string, string> = {
  spa: 'es',
  eng: 'en',
  por: 'pt',
};

export function toIso1Language(iso3: string | null | undefined): string | null {
  return iso3 ? (LANGUAGE_ISO3_TO_ISO1[iso3.toLowerCase()] ?? null) : null;
}

/** Percentil por rango más cercano sobre una lista ya ordenada. */
function percentile(sorted: number[], p: number): number {
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

export interface ElevationRange {
  minElevationM: number;
  maxElevationM: number;
  sampleSize: number;
}

/**
 * Rango central de altitud (percentiles 5 y 95) de una muestra de registros.
 * Descarta valores imposibles para tierra firme. Devuelve null si hay pocos datos.
 */
export function elevationRange(
  values: number[],
  minSample = 20,
): ElevationRange | null {
  const valid = values
    .filter((v) => Number.isFinite(v) && v >= -50 && v <= 6500)
    .sort((a, b) => a - b);
  if (valid.length < minSample) return null;
  return {
    minElevationM: Math.round(percentile(valid, 5)),
    maxElevationM: Math.round(percentile(valid, 95)),
    sampleSize: valid.length,
  };
}
