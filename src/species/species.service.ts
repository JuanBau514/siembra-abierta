import { Inject, Injectable } from '@nestjs/common';
import { normalizeText } from '../importers/gbif/normalize.js';
import { CATEGORY_BY_CODE, CODE_BY_CATEGORY } from './species.model.js';
import type { PlantCategoryName } from '../i18n/i18n.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_LIMIT = 50;
const clamp = (limit: number) => Math.min(Math.max(limit, 1), MAX_LIMIT);

const withRelations = {
  genus: { include: { family: true } },
  commonNames: true,
  distributions: true,
  invasionStatuses: true,
  categories: true,
  images: { include: { license: true }, orderBy: { position: 'asc' } },
} as const;

type SpeciesRow = NonNullable<Awaited<ReturnType<SpeciesService['loadById']>>>;

/** Convierte una fila de la base de datos (español, 3FN) en la forma que expone la API. */
export function toSpecies(row: SpeciesRow) {
  const canonicalName = `${row.genus.name} ${row.epithet}`;
  return {
    id: row.id,
    canonicalName,
    scientificName: row.authorship
      ? `${canonicalName} ${row.authorship}`
      : canonicalName,
    genus: row.genus.name,
    family: row.genus.family?.name ?? null,
    commonNames: row.commonNames.map((c) => ({
      id: c.id,
      name: c.name,
      language: c.languageCode,
      countryIso: c.countryCode,
      region: c.region,
    })),
    distributions: row.distributions.map((d) => ({
      countryIso: d.countryCode,
      occurrenceCount: d.occurrenceCount,
      minElevationM: d.minElevationM,
      maxElevationM: d.maxElevationM,
      elevationSampleSize: d.elevationSampleSize,
    })),
    invasionStatuses: row.invasionStatuses.map(toInvasionStatus),
    categories: row.categories.flatMap(
      (c) => CATEGORY_BY_CODE[c.categoryCode] ?? [],
    ),
    images: row.images.map((i) => ({
      id: i.id,
      url: i.url,
      thumbnailUrl: i.thumbnailUrl,
      pageUrl: i.pageUrl,
      author: i.author,
      license: i.licenseCode,
      licenseUrl: i.license.url,
      countryIso: i.countryCode,
    })),
  };
}

type InvasionRow = SpeciesRow['invasionStatuses'][number];

function toInvasionStatus(row: InvasionRow) {
  return {
    id: row.id,
    status: row.status,
    riskLevel: row.riskLevel,
    countryIso: row.countryCode,
    region: row.region,
    minElevationM: row.minElevationM,
    maxElevationM: row.maxElevationM,
    impact: row.impact,
    management: row.management,
    verification: row.verification,
  };
}

@Injectable()
export class SpeciesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  loadById(id: string) {
    return this.prisma.species.findUnique({
      where: { id },
      include: withRelations,
    });
  }

  async findById(id: string) {
    const row = await this.loadById(id);
    return row ? toSpecies(row) : null;
  }

  /**
   * Busca por nombre científico o común. Primero van las coincidencias exactas ("lulo" →
   * la especie que se llama lulo) y, dentro de ellas, las plantas cultivadas; después las
   * que solo contienen el texto.
   */
  async search(query: string, limit: number) {
    const text = normalizeText(query);
    const take = clamp(limit);
    const exact = await this.prisma.species.findMany({
      where: {
        OR: [
          { nameNormalized: text },
          { commonNames: { some: { nameNormalized: text } } },
        ],
      },
      include: withRelations,
      orderBy: [{ genus: { name: 'asc' } }, { epithet: 'asc' }],
      take,
    });
    exact.sort((a, b) => b.categories.length - a.categories.length);
    const partial =
      exact.length < take
        ? await this.prisma.species.findMany({
            where: {
              id: { notIn: exact.map((row) => row.id) },
              OR: [
                { nameNormalized: { contains: text } },
                {
                  commonNames: { some: { nameNormalized: { contains: text } } },
                },
              ],
            },
            include: withRelations,
            orderBy: [{ genus: { name: 'asc' } }, { epithet: 'asc' }],
            take: take - exact.length,
          })
        : [];
    return [...exact, ...partial].map(toSpecies);
  }

  /** Especies de una categoría (frutas, flores...) presentes en un país, en orden alfabético. */
  async byCategory(
    category: PlantCategoryName,
    countryIso: string,
    limit: number,
    offset: number,
  ) {
    const rows = await this.prisma.species.findMany({
      where: {
        categories: { some: { categoryCode: CODE_BY_CATEGORY[category] } },
        distributions: { some: { countryCode: countryIso.toUpperCase() } },
      },
      include: withRelations,
      orderBy: [{ genus: { name: 'asc' } }, { epithet: 'asc' }],
      take: clamp(limit),
      skip: Math.max(offset, 0),
    });
    return rows.map(toSpecies);
  }

  async invasive(countryIso: string, limit: number) {
    const rows = await this.prisma.invasionStatus.findMany({
      where: { countryCode: countryIso.toUpperCase(), status: 'INVASIVE' },
      include: { species: { include: withRelations } },
      orderBy: { riskLevel: 'desc' },
      take: clamp(limit),
    });
    return rows.map((row) => ({
      ...toInvasionStatus(row),
      species: toSpecies(row.species),
    }));
  }
}
