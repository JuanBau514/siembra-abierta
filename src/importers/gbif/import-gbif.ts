import type { PrismaClient } from '../../generated/prisma/client.js';
import { GbifClient } from './gbif-client.js';
import {
  cleanDisplayName,
  elevationRange,
  normalizeText,
  splitVernacularNames,
  toIso1Language,
  toOpenLicense,
  type OpenLicense,
} from './normalize.js';

/** Dataset de GBIF que contiene la taxonomía de referencia (GBIF Backbone). */
const BACKBONE_DATASET_KEY = 'd7dddbf4-2cf0-4f39-9b2a-bb099caae36c';
const OCCURRENCES_SOURCE_ID = 'gbif-occurrences';

export interface ImportOptions {
  country: string;
  limit: number;
  basisOfRecord: string;
  /** Idiomas de nombres comunes a importar (ISO 639-3, como los entrega GBIF). */
  languages: string[];
  dryRun: boolean;
}

export interface ImportStats {
  speciesSeen: number;
  speciesSaved: number;
  speciesSkipped: number;
  commonNamesSaved: number;
  commonNamesRejectedLicense: number;
  elevationsSaved: number;
}

interface SourceRef {
  id: string;
  license: OpenLicense;
}

export class GbifImporter {
  private readonly datasetCache = new Map<string, SourceRef | null>();
  private readonly speciesDatasetCache = new Map<number, string | null>();

  constructor(
    private readonly prisma: PrismaClient | null,
    private readonly gbif: GbifClient,
    private readonly log: (message: string) => void = console.log,
  ) {}

  async run(options: ImportOptions): Promise<ImportStats> {
    const stats: ImportStats = {
      speciesSeen: 0,
      speciesSaved: 0,
      speciesSkipped: 0,
      commonNamesSaved: 0,
      commonNamesRejectedLicense: 0,
      elevationsSaved: 0,
    };
    const country = options.country.toUpperCase();

    const backbone = await this.resolveDatasetSource(BACKBONE_DATASET_KEY);
    if (!backbone)
      throw new Error(
        'La taxonomía de referencia de GBIF no tiene licencia abierta.',
      );
    const occurrencesSource = await this.ensureOccurrencesSource();

    const top = await this.gbif.topPlantSpecies(
      country,
      options.limit,
      options.basisOfRecord,
    );
    this.log(
      `GBIF devolvió ${top.length} especies candidatas para ${country}.`,
    );

    for (const { speciesKey, occurrenceCount } of top) {
      stats.speciesSeen++;
      const taxon = await this.gbif.species(speciesKey);
      const accepted =
        taxon.rank === 'SPECIES' &&
        taxon.taxonomicStatus === 'ACCEPTED' &&
        taxon.kingdom === 'Plantae' &&
        !!taxon.canonicalName;
      if (!accepted) {
        stats.speciesSkipped++;
        this.log(
          `  · omitida ${speciesKey} (${taxon.scientificName}): no es especie aceptada de Plantae`,
        );
        continue;
      }
      const canonicalName = cleanDisplayName(taxon.canonicalName!);

      const names = await this.collectCommonNames(
        speciesKey,
        options.languages,
        stats,
      );
      const elevation = elevationRange(
        await this.gbif.elevations(country, speciesKey),
      );

      this.log(
        `  ✓ ${canonicalName}: ${occurrenceCount} registros, ` +
          `${names.length} nombres, altitud ${elevation ? `${elevation.minElevationM}–${elevation.maxElevationM} m (n=${elevation.sampleSize})` : 'sin datos suficientes'}`,
      );
      stats.speciesSaved++;
      stats.commonNamesSaved += names.length;
      if (elevation) stats.elevationsSaved++;
      if (options.dryRun || !this.prisma) continue;

      const species = await this.prisma.species.upsert({
        where: { canonicalName },
        create: {
          canonicalName,
          scientificName: taxon.scientificName,
          nameNormalized: normalizeText(canonicalName),
          genus: taxon.genus ?? null,
          family: taxon.family ?? null,
          gbifKey: taxon.key,
          sourceId: backbone.id,
        },
        update: {
          scientificName: taxon.scientificName,
          genus: taxon.genus ?? null,
          family: taxon.family ?? null,
          gbifKey: taxon.key,
          sourceId: backbone.id,
        },
      });

      await this.prisma.speciesCountry.upsert({
        where: {
          speciesId_countryIso: { speciesId: species.id, countryIso: country },
        },
        create: {
          speciesId: species.id,
          countryIso: country,
          occurrenceCount,
          minElevationM: elevation?.minElevationM ?? null,
          maxElevationM: elevation?.maxElevationM ?? null,
          elevationSampleSize: elevation?.sampleSize ?? null,
          sourceId: occurrencesSource.id,
        },
        update: {
          occurrenceCount,
          minElevationM: elevation?.minElevationM ?? null,
          maxElevationM: elevation?.maxElevationM ?? null,
          elevationSampleSize: elevation?.sampleSize ?? null,
          sourceId: occurrencesSource.id,
        },
      });

      if (names.length > 0) {
        await this.prisma.commonName.createMany({
          data: names.map((n) => ({ ...n, speciesId: species.id })),
          skipDuplicates: true,
        });
      }
    }
    return stats;
  }

  /** Nombres comunes de una especie, solo de fuentes con licencia abierta. */
  private async collectCommonNames(
    speciesKey: number,
    languages: string[],
    stats: ImportStats,
  ) {
    const result: {
      name: string;
      nameNormalized: string;
      language: string;
      countryIso: string | null;
      sourceId: string;
    }[] = [];
    const seen = new Set<string>();

    for (const record of await this.gbif.vernacularNames(speciesKey)) {
      const language = toIso1Language(record.language);
      if (
        !language ||
        !record.language ||
        !languages.includes(record.language.toLowerCase())
      )
        continue;

      const source = await this.sourceForVernacular(record.sourceTaxonKey);
      if (!source) {
        stats.commonNamesRejectedLicense++;
        continue;
      }
      const countryIso =
        record.country && /^[A-Za-z]{2}$/.test(record.country)
          ? record.country.toUpperCase()
          : null;

      for (const name of splitVernacularNames(record.vernacularName)) {
        const nameNormalized = normalizeText(name);
        const key = `${nameNormalized}|${language}|${source.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          name,
          nameNormalized,
          language,
          countryIso,
          sourceId: source.id,
        });
      }
    }
    return result;
  }

  /** Cada nombre común trae `sourceTaxonKey`; de ahí se llega a su dataset y a su licencia. */
  private async sourceForVernacular(
    sourceTaxonKey?: number,
  ): Promise<SourceRef | null> {
    if (!sourceTaxonKey) return null;
    let datasetKey = this.speciesDatasetCache.get(sourceTaxonKey);
    if (datasetKey === undefined) {
      try {
        datasetKey = (await this.gbif.species(sourceTaxonKey)).datasetKey;
      } catch {
        datasetKey = null;
      }
      this.speciesDatasetCache.set(sourceTaxonKey, datasetKey);
    }
    return datasetKey ? this.resolveDatasetSource(datasetKey) : null;
  }

  /** Devuelve la fuente solo si el dataset tiene licencia abierta (CC0 o CC-BY). */
  private async resolveDatasetSource(
    datasetKey: string,
  ): Promise<SourceRef | null> {
    if (this.datasetCache.has(datasetKey))
      return this.datasetCache.get(datasetKey)!;
    const dataset = await this.gbif.dataset(datasetKey);
    const license = toOpenLicense(dataset.license);
    let ref: SourceRef | null = null;
    if (license) {
      ref = {
        license,
        id: this.prisma
          ? (
              await this.prisma.source.upsert({
                where: { externalId: datasetKey },
                create: {
                  externalId: datasetKey,
                  name: dataset.title,
                  url: `https://www.gbif.org/dataset/${datasetKey}`,
                  license,
                  licenseUrl: dataset.license,
                  citation: dataset.citation?.text ?? null,
                },
                update: {
                  name: dataset.title,
                  license,
                  licenseUrl: dataset.license,
                },
              })
            ).id
          : `dry-run:${datasetKey}`,
      };
    } else {
      this.log(
        `  · fuente excluida por licencia no abierta: ${dataset.title} (${dataset.license})`,
      );
    }
    this.datasetCache.set(datasetKey, ref);
    return ref;
  }

  private async ensureOccurrencesSource(): Promise<{ id: string }> {
    if (!this.prisma) return { id: `dry-run:${OCCURRENCES_SOURCE_ID}` };
    return this.prisma.source.upsert({
      where: { externalId: OCCURRENCES_SOURCE_ID },
      create: {
        externalId: OCCURRENCES_SOURCE_ID,
        name: 'GBIF: registros de ocurrencias (CC0 y CC-BY)',
        url: 'https://www.gbif.org/occurrence/search',
        license: 'CC-BY-4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
        citation:
          'GBIF.org. Registros de ocurrencias con licencia CC0 o CC-BY. Cada registro pertenece a su dataset y publicador.',
      },
      update: {},
    });
  }
}
