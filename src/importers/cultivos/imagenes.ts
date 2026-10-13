import type { GbifImageOccurrence } from '../gbif/gbif-client.js';
import { toOpenLicense, type OpenLicense } from '../gbif/normalize.js';

export interface ImageCandidate {
  url: string;
  thumbnailUrl: string | null;
  pageUrl: string;
  author: string;
  license: OpenLicense;
  countryCode: string | null;
}

const INATURALIST_PHOTO =
  /^(https:\/\/inaturalist-open-data\.s3\.amazonaws\.com\/photos\/\d+\/)\w+(\.\w+)$/;

/**
 * iNaturalist publica cada foto en varios tamaños. El original puede pesar varios MB:
 * para mostrar se usa `large` (1024 px) y para listas `medium` (500 px), con la
 * misma extensión que el original.
 */
export function imageSizes(identifier: string) {
  const match = INATURALIST_PHOTO.exec(identifier);
  // Los tamaños derivados conservan la extensión del original (.jpg, .jpeg, .png).
  return match
    ? {
        url: `${match[1]}large${match[2]}`,
        thumbnailUrl: `${match[1]}medium${match[2]}`,
      }
    : { url: identifier, thumbnailUrl: null };
}

/**
 * Elige hasta `max` fotos de las observaciones. Reglas:
 * - Solo licencia CC0 o CC-BY a nivel de FOTO (la del registro puede ser distinta).
 * - Debe tener autoría: CC-BY exige atribución.
 * - Solo https y sin repetir enlaces.
 * - Se prefieren autores distintos para tener variedad; el orden de entrada
 *   (primero las de Colombia) se respeta.
 */
export function pickImages(
  occurrences: GbifImageOccurrence[],
  max: number,
): ImageCandidate[] {
  const valid: ImageCandidate[] = [];
  const urls = new Set<string>();
  for (const occurrence of occurrences) {
    for (const media of occurrence.media ?? []) {
      const license = toOpenLicense(media.license);
      const author = (media.creator ?? media.rightsHolder ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      if (
        !license ||
        !author ||
        !media.identifier ||
        !media.identifier.startsWith('https://') ||
        (media.type && media.type !== 'StillImage')
      )
        continue;
      const sizes = imageSizes(media.identifier);
      if (urls.has(sizes.url)) continue;
      urls.add(sizes.url);
      valid.push({
        ...sizes,
        pageUrl:
          media.references ??
          `https://www.gbif.org/occurrence/${occurrence.key}`,
        author,
        license,
        countryCode: /^[A-Za-z]{2}$/.test(occurrence.countryCode ?? '')
          ? occurrence.countryCode!.toUpperCase()
          : null,
      });
    }
  }
  const authors = new Set<string>();
  const first = valid.filter((c) => {
    if (authors.has(c.author)) return false;
    authors.add(c.author);
    return true;
  });
  const rest = valid.filter((c) => !first.includes(c));
  return [...first, ...rest].slice(0, max);
}
