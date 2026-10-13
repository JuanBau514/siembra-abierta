import type { PrismaClient } from '../../generated/prisma/client.js';
import { GbifClient } from './gbif-client.js';
import {
  cleanDisplayName,
  elevationRange,
  normalizeText,
  splitScientificName,
  splitVernacularNames,
  toIso1Language,
  toOpenLicense,
  type OpenLicense,
} from './normalize.js';

/** Dataset de GBIF que contiene la taxonomía de referencia (GBIF Backbone). */
const BACKBONE_DATASET_KEY = 'd7dddbf4-2cf0-4f39-9b2a-bb099caae36c';
const OCCURRENCES_SOURCE_ID = 'gbif-occurrences';
/** Con menos registros no se calcula altitud: la muestra no sería confiable. */
const MIN_RECORDS_FOR_ELEVATION = 20;

export interface ImportOptions {
  country: string;
  limit: number;
  /** null = cualquier tipo de registro (observaciones, especímenes de herbario, etc.). */
  basisOfRecord: string | null;
  /** Idiomas de nombres comunes a importar (ISO 639-3, como los entrega GBIF). */
  languages: string[];
  concurrency: number;
  /** Omite especies que ya están importadas para este país (permite reanudar). */
  skipExisting: boolean;
  dryRun: boolean;
}

export interface ImportStats {
  speciesSeen: number;
  speciesSaved: number;
  speciesSkipped: number;
  speciesFailed: number;
  commonNamesSaved: number;
  commonNamesRejectedLicense: number;
  elevationsSaved: number;
}

interface Candidate {
  speciesKey: number;
  occurrenceCount: number;
}

interface SourceRef {
  id: string;
  license: OpenLicense;
}

interface CommonNameRow {
  name: string;
  nameNormalized: string;
  languageCode: string;
  countryCode: string | null;
  sourceId: string;
}

const countryNames = new Intl.DisplayNames(['es'], { type: 'region' });
const LICENSE_NAMES: Record<OpenLicense, { name: string; url: string }> = {
  'CC0-1.0': {
    name: 'Creative Commons Cero 1.0 (dominio público)',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  'CC-BY-4.0': {
    name: 'Creative Commons Atribución 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
  },
};

export class GbifImporter {
  /** Dataset de cada nombre de fuente ("Catalogue of Life" → fuente con licencia, o null si no es abierta). */
  private readonly sourceByLabel = new Map<string, Promise<SourceRef | null>>();
  private readonly datasetCache = new Map<string, Promise<SourceRef | null>>();
  private readonly familyIds = new Map<string, Promise<string>>();
  private readonly genusIds = new Map<string, Promise<string>>();
  private readonly languageIds = new Set<string>();
  private readonly failures: { key: number; reason: string }[] = [];

  constructor(
    private readonly prisma: PrismaClient | null,
    private readonly gbif: GbifClient,
    private readonly log: (message: string) => void = console.log,
  ) {}

  get failedSpecies() {
    return this.failures;
  }

  async run(options: ImportOptions): Promise<ImportStats> {
    const country = options.country.toUpperCase();
    const candidates = await this.gbif.topPlantSpecies(
      country,
      options.limit,
      options.basisOfRecord,
    );
    this.log(
      `GBIF devolvió ${candidates.length} especies candidatas para ${country}.`,
    );
    return this.process(candidates, options);
  }

  /**
   * Importa una lista concreta de especies (por clave de GBIF) para un país, aunque no
   * tengan registros abiertos allí: el conteo queda en 0. Sirve para catálogos curados.
   */
  async runForKeys(
    speciesKeys: number[],
    options: Omit<ImportOptions, 'limit' | 'basisOfRecord'>,
  ): Promise<ImportStats> {
    const country = options.country.toUpperCase();
    const candidates: Candidate[] = [];
    for (const speciesKey of speciesKeys) {
      candidates.push({
        speciesKey,
        occurrenceCount: await this.gbif.occurrenceCount(country, speciesKey),
      });
    }
    return this.process(candidates, {
      ...options,
      limit: speciesKeys.length,
      basisOfRecord: null,
    });
  }

  private async process(
    candidates: Candidate[],
    options: ImportOptions,
  ): Promise<ImportStats> {
    const stats: ImportStats = {
      speciesSeen: 0,
      speciesSaved: 0,
      speciesSkipped: 0,
      speciesFailed: 0,
      commonNamesSaved: 0,
      commonNamesRejectedLicense: 0,
      elevationsSaved: 0,
    };
    const country = options.country.toUpperCase();

    const backbone = await this.sourceForDataset(BACKBONE_DATASET_KEY);
    if (!backbone)
      throw new Error(
        'La taxonomía de referencia de GBIF no tiene licencia abierta.',
      );
    const occurrencesSource = await this.ensureOccurrencesSource();
    await this.ensureCountry(country);

    const alreadyImported = options.skipExisting
      ? await this.importedKeys(country)
      : new Set<number>();
    const pending = candidates.filter(
      (c) => !alreadyImported.has(c.speciesKey),
    );
    stats.speciesSkipped += candidates.length - pending.length;
    if (alreadyImported.size > 0)
      this.log(`Se omiten ${stats.speciesSkipped} especies ya importadas.`);

    const startedAt = Date.now();
    let done = 0;
    let next = 0;
    const worker = async () => {
      while (next < pending.length) {
        const candidate = pending[next++];
        stats.speciesSeen++;
        try {
          await this.importSpecies(
            candidate,
            country,
            options,
            backbone,
            occurrencesSource,
            stats,
          );
        } catch (error) {
          stats.speciesFailed++;
          const reason = error instanceof Error ? error.message : String(error);
          this.failures.push({ key: candidate.speciesKey, reason });
          this.log(`  ✗ falló la especie ${candidate.speciesKey}: ${reason}`);
        }
        done++;
        if (done % 100 === 0 || done === pending.length) {
          const perSecond = done / ((Date.now() - startedAt) / 1000);
          const remaining = Math.round(
            (pending.length - done) / perSecond / 60,
          );
          this.log(
            `  … ${done}/${pending.length} (${perSecond.toFixed(1)} especies/s, ` +
              `quedan ~${remaining} min) · guardadas ${stats.speciesSaved}, omitidas ${stats.speciesSkipped}, fallidas ${stats.speciesFailed}`,
          );
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.max(1, options.concurrency) }, worker),
    );
    return stats;
  }

  private async importSpecies(
    candidate: Candidate,
    country: string,
    options: ImportOptions,
    backbone: SourceRef,
    occurrencesSource: { id: string },
    stats: ImportStats,
  ) {
    const { speciesKey, occurrenceCount } = candidate;
    const taxon = await this.gbif.species(speciesKey);
    const accepted =
      taxon.rank === 'SPECIES' &&
      taxon.taxonomicStatus === 'ACCEPTED' &&
      taxon.kingdom === 'Plantae' &&
      !!taxon.canonicalName;
    const parts = accepted
      ? splitScientificName(
          taxon.canonicalName!,
          taxon.scientificName,
          taxon.genus,
        )
      : null;
    if (!parts) {
      stats.speciesSkipped++;
      return;
    }

    const names = await this.collectCommonNames(
      speciesKey,
      options.languages,
      stats,
    );
    const elevation =
      occurrenceCount >= MIN_RECORDS_FOR_ELEVATION
        ? elevationRange(await this.gbif.elevations(country, speciesKey))
        : null;

    stats.speciesSaved++;
    stats.commonNamesSaved += names.length;
    if (elevation) stats.elevationsSaved++;
    if (options.dryRun || !this.prisma) {
      this.log(
        `  ✓ ${parts.genus} ${parts.epithet}: ${occurrenceCount} registros, ${names.length} nombres, ` +
          `altitud ${elevation ? `${elevation.minElevationM}–${elevation.maxElevationM} m` : 'sin datos suficientes'}`,
      );
      return;
    }

    const familyId = taxon.family ? await this.familyId(taxon.family) : null;
    const genusId = await this.genusId(parts.genus, familyId);
    const canonical = `${parts.genus} ${parts.epithet}`;
    const species = await this.prisma.species.upsert({
      where: { gbifKey: taxon.key },
      create: {
        genusId,
        epithet: parts.epithet,
        authorship: parts.authorship,
        nameNormalized: normalizeText(canonical),
        gbifKey: taxon.key,
        sourceId: backbone.id,
      },
      update: {
        genusId,
        epithet: parts.epithet,
        authorship: parts.authorship,
        nameNormalized: normalizeText(canonical),
        sourceId: backbone.id,
      },
    });

    const distribution = {
      occurrenceCount,
      minElevationM: elevation?.minElevationM ?? null,
      maxElevationM: elevation?.maxElevationM ?? null,
      elevationSampleSize: elevation?.sampleSize ?? null,
      sourceId: occurrencesSource.id,
    };
    await this.prisma.speciesCountry.upsert({
      where: {
        speciesId_countryCode: { speciesId: species.id, countryCode: country },
      },
      create: { speciesId: species.id, countryCode: country, ...distribution },
      update: distribution,
    });

    if (names.length > 0) {
      for (const language of new Set(names.map((n) => n.languageCode)))
        await this.ensureLanguage(language);
      for (const countryCode of new Set(
        names.map((n) => n.countryCode).filter((c): c is string => !!c),
      )) {
        await this.ensureCountry(countryCode);
      }
      await this.prisma.commonName.createMany({
        data: names.map((n) => ({ ...n, speciesId: species.id })),
        skipDuplicates: true,
      });
    }
  }

  /** Claves GBIF de las especies que ya tienen datos para este país. */
  private async importedKeys(country: string) {
    if (!this.prisma) return new Set<number>();
    const rows = await this.prisma.species.findMany({
      where: {
        gbifKey: { not: null },
        distributions: { some: { countryCode: country } },
      },
      select: { gbifKey: true },
    });
    return new Set(rows.map((r) => r.gbifKey!));
  }

  private familyId(name: string): Promise<string> {
    const key = cleanDisplayName(name);
    let id = this.familyIds.get(key);
    if (!id) {
      id = this.prisma!.family.upsert({
        where: { name: key },
        create: { name: key },
        update: {},
      }).then((f) => f.id);
      this.familyIds.set(key, id);
    }
    return id;
  }

  private genusId(name: string, familyId: string | null): Promise<string> {
    let id = this.genusIds.get(name);
    if (!id) {
      id = this.prisma!.genus.upsert({
        where: { name },
        create: { name, familyId },
        update: familyId ? { familyId } : {},
      }).then((g) => g.id);
      this.genusIds.set(name, id);
    }
    return id;
  }

  /** Los países y los idiomas son tablas de referencia: se crean la primera vez que aparecen. */
  private async ensureCountry(isoCode: string) {
    if (!this.prisma) return;
    const name = countryNames.of(isoCode) ?? isoCode;
    await this.prisma.country.upsert({
      where: { isoCode },
      create: { isoCode, name },
      update: {},
    });
  }

  private async ensureLanguage(code: string) {
    if (!this.prisma || this.languageIds.has(code)) return;
    const name =
      new Intl.DisplayNames(['es'], { type: 'language' }).of(code) ?? code;
    await this.prisma.language.upsert({
      where: { code },
      create: { code, name: cleanDisplayName(name) },
      update: {},
    });
    this.languageIds.add(code);
  }

  /** Nombres comunes de una especie, solo de fuentes con licencia abierta. */
  private async collectCommonNames(
    speciesKey: number,
    languages: string[],
    stats: ImportStats,
  ) {
    const result: CommonNameRow[] = [];
    const seen = new Set<string>();

    for (const record of await this.gbif.vernacularNames(speciesKey)) {
      const languageCode = toIso1Language(record.language);
      if (!languageCode || !languages.includes(record.language!.toLowerCase()))
        continue;

      const source = await this.sourceForVernacular(
        record.source,
        record.sourceTaxonKey,
      );
      if (!source) {
        stats.commonNamesRejectedLicense++;
        continue;
      }
      const countryCode =
        record.country && /^[A-Za-z]{2}$/.test(record.country)
          ? record.country.toUpperCase()
          : null;

      for (const name of splitVernacularNames(record.vernacularName)) {
        const nameNormalized = normalizeText(name);
        const key = `${nameNormalized}|${languageCode}|${source.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          name,
          nameNormalized,
          languageCode,
          countryCode,
          sourceId: source.id,
        });
      }
    }
    return result;
  }

  /**
   * Cada nombre común trae el texto de su fuente ("Catalogue of Life") y un `sourceTaxonKey`.
   * Se resuelve una vez por texto de fuente: de ahí se llega al dataset y a su licencia.
   */
  private sourceForVernacular(
    label?: string,
    sourceTaxonKey?: number,
  ): Promise<SourceRef | null> {
    if (!label || !sourceTaxonKey) return Promise.resolve(null);
    let source = this.sourceByLabel.get(label);
    if (!source) {
      source = this.gbif
        .species(sourceTaxonKey)
        .then((taxon) => this.sourceForDataset(taxon.datasetKey))
        .catch(() => null);
      this.sourceByLabel.set(label, source);
    }
    return source;
  }

  /** Devuelve la fuente solo si el dataset tiene licencia abierta (CC0 o CC-BY). */
  private sourceForDataset(datasetKey: string): Promise<SourceRef | null> {
    let source = this.datasetCache.get(datasetKey);
    if (!source) {
      source = this.resolveDataset(datasetKey);
      this.datasetCache.set(datasetKey, source);
    }
    return source;
  }

  private async resolveDataset(datasetKey: string): Promise<SourceRef | null> {
    const dataset = await this.gbif.dataset(datasetKey);
    const license = toOpenLicense(dataset.license);
    if (!license) {
      this.log(
        `  · fuente excluida por licencia no abierta: ${dataset.title} (${dataset.license})`,
      );
      return null;
    }
    if (!this.prisma) return { license, id: `dry-run:${datasetKey}` };
    const row = await this.prisma.source.upsert({
      where: { externalId: datasetKey },
      create: {
        externalId: datasetKey,
        name: dataset.title,
        url: `https://www.gbif.org/dataset/${datasetKey}`,
        licenseCode: license,
        citation: dataset.citation?.text ?? null,
      },
      update: { name: dataset.title, licenseCode: license },
    });
    return { license, id: row.id };
  }

  private async ensureOccurrencesSource(): Promise<{ id: string }> {
    if (!this.prisma) return { id: `dry-run:${OCCURRENCES_SOURCE_ID}` };
    const license: OpenLicense = 'CC-BY-4.0'; // la más exigente de las admitidas: pide atribución
    await this.prisma.license.upsert({
      where: { code: license },
      create: { code: license, ...LICENSE_NAMES[license] },
      update: {},
    });
    return this.prisma.source.upsert({
      where: { externalId: OCCURRENCES_SOURCE_ID },
      create: {
        externalId: OCCURRENCES_SOURCE_ID,
        name: 'GBIF: registros de ocurrencias (CC0 y CC-BY)',
        url: 'https://www.gbif.org/occurrence/search',
        licenseCode: license,
        citation:
          'GBIF.org. Registros de ocurrencias con licencia CC0 o CC-BY. Cada registro pertenece a su dataset y publicador.',
      },
      update: {},
    });
  }
}
