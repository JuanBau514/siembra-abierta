import type {
  OriginStatus,
  RiskLevel,
  VerificationStatus,
} from '../generated/prisma/enums.js';

/** Categorías de uso de una planta tal como las expone la API. */
export type PlantCategoryName = 'FRUIT' | 'VEGETABLE' | 'CROP' | 'FLOWER';

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type Lang = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANG: Lang = 'es';

const isLang = (value: string): value is Lang =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

/**
 * Elige el idioma de la respuesta. Prioridad: parámetro `?lang=` y, si no, el encabezado
 * `Accept-Language` (se respeta el orden y el factor q). Por defecto, español.
 */
export function resolveLang(
  acceptLanguage?: string | string[],
  queryLang?: unknown,
): Lang {
  if (
    typeof queryLang === 'string' &&
    isLang(queryLang.slice(0, 2).toLowerCase())
  ) {
    return queryLang.slice(0, 2).toLowerCase() as Lang;
  }
  const header = Array.isArray(acceptLanguage)
    ? acceptLanguage.join(',')
    : (acceptLanguage ?? '');
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = Number(
        params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1,
      );
      return {
        lang: tag.slice(0, 2).toLowerCase(),
        q: Number.isFinite(q) ? q : 0,
      };
    })
    .sort((a, b) => b.q - a.q);
  return (
    (ranked.find((r) => isLang(r.lang))?.lang as Lang | undefined) ??
    DEFAULT_LANG
  );
}

interface Labels {
  origin: Record<OriginStatus, string>;
  risk: Record<RiskLevel, string>;
  verification: Record<VerificationStatus, string>;
  category: Record<PlantCategoryName, string>;
}

/** Textos para mostrar de los valores enumerados. Agregar un idioma = agregar una entrada aquí. */
export const LABELS: Record<Lang, Labels> = {
  es: {
    origin: {
      NATIVE: 'Nativa',
      INTRODUCED: 'Introducida',
      INVASIVE: 'Invasora',
    },
    risk: { LOW: 'Riesgo bajo', MEDIUM: 'Riesgo medio', HIGH: 'Riesgo alto' },
    verification: {
      REPORTED: 'Reportado',
      CORROBORATED: 'Corroborado',
      EXPERT_VERIFIED: 'Verificado por expertos',
    },
    category: {
      FRUIT: 'Frutas',
      VEGETABLE: 'Hortalizas y verduras',
      CROP: 'Cultivos',
      FLOWER: 'Flores',
    },
  },
  en: {
    origin: {
      NATIVE: 'Native',
      INTRODUCED: 'Introduced',
      INVASIVE: 'Invasive',
    },
    risk: { LOW: 'Low risk', MEDIUM: 'Medium risk', HIGH: 'High risk' },
    verification: {
      REPORTED: 'Reported',
      CORROBORATED: 'Corroborated',
      EXPERT_VERIFIED: 'Expert verified',
    },
    category: {
      FRUIT: 'Fruits',
      VEGETABLE: 'Vegetables',
      CROP: 'Crops',
      FLOWER: 'Flowers',
    },
  },
};
