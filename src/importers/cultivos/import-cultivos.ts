import type { PrismaClient } from '../../generated/prisma/client.js';
import type { GbifClient } from '../gbif/gbif-client.js';
import { GbifImporter } from '../gbif/import-gbif.js';
import { cleanDisplayName, normalizeText } from '../gbif/normalize.js';
import {
  CATALOGO_CULTIVOS,
  type Categoria,
  type EntradaCatalogo,
} from './catalogo.js';
import { pickImages, type ImageCandidate } from './imagenes.js';

const COUNTRY = 'CO';
const CATALOG_SOURCE_ID = 'siembra-abierta-catalogo-cultivos';
const OCCURRENCES_SOURCE_ID = 'gbif-occurrences';
const SPECIES_RANKS = new Set(['SPECIES', 'SUBSPECIES', 'VARIETY', 'FORM']);

export interface CultivosOptions {
  imagesPerSpecies: number;
  skipImages: boolean;
  dryRun: boolean;
  concurrency: number;
}

export interface CultivosStats {
  catalogEntries: number;
  unresolved: string[];
  speciesTotal: number;
  categoriesSaved: number;
  catalogNamesSaved: number;
  imagesSaved: number;
  imagesRejectedDead: number;
  speciesWithoutImages: string[];
}

interface ResolvedSpecies {
  speciesKey: number;
  /** Nombre del catálogo (la primera entrada que la resolvió). */
  label: string;
  categories: Set<Categoria>;
  names: Set<string>;
}

/** Ejecuta `task` sobre cada elemento con un máximo de tareas simultáneas. */
async function pool<T>(
  items: T[],
  size: number,
  task: (item: T) => Promise<void>,
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, size) }, async () => {
      while (next < items.length) await task(items[next++]);
    }),
  );
}

export class CultivosImporter {
  constructor(
    private readonly prisma: PrismaClient | null,
    private readonly gbif: GbifClient,
    private readonly log: (message: string) => void = console.log,
    private readonly catalog: EntradaCatalogo[] = CATALOGO_CULTIVOS,
  ) {}

  async run(options: CultivosOptions): Promise<CultivosStats> {
    const stats: CultivosStats = {
      catalogEntries: this.catalog.length,
      unresolved: [],
      speciesTotal: 0,
      categoriesSaved: 0,
      catalogNamesSaved: 0,
      imagesSaved: 0,
      imagesRejectedDead: 0,
      speciesWithoutImages: [],
    };

    const resolved = await this.resolveCatalog(stats);
    stats.speciesTotal = resolved.size;
    this.log(
      `Catálogo: ${this.catalog.length} entradas → ${resolved.size} especies en GBIF` +
        ` (${stats.unresolved.length} sin resolver).`,
    );

    if (this.prisma && !options.dryRun) {
      this.log('Importando taxonomía y nombres comunes desde GBIF…');
      const importer = new GbifImporter(this.prisma, this.gbif, this.log);
      await importer.runForKeys([...resolved.keys()], {
        country: COUNTRY,
        languages: ['spa'],
        concurrency: options.concurrency,
        skipExisting: true,
        dryRun: false,
      });
      for (const failure of importer.failedSpecies)
        this.log(`  ✗ taxonomía fallida ${failure.key}: ${failure.reason}`);

      await this.saveCategoriesAndNames([...resolved.values()], stats);
    }

    if (!options.skipImages)
      await this.importImages([...resolved.values()], options, stats);
    return stats;
  }

  /** Busca cada nombre del catálogo en GBIF y junta las entradas que dan a la misma especie. */
  private async resolveCatalog(stats: CultivosStats) {
    const resolved = new Map<number, ResolvedSpecies>();
    for (const entry of this.catalog) {
      const match = await this.gbif.matchSpecies(entry.cientifico);
      const key = match.speciesKey;
      if (
        match.matchType !== 'EXACT' ||
        !key ||
        !match.rank ||
        !SPECIES_RANKS.has(match.rank)
      ) {
        stats.unresolved.push(entry.cientifico);
        this.log(
          `  ? sin resolver: ${entry.cientifico} (${match.matchType}, ${match.rank})`,
        );
        continue;
      }
      const found = resolved.get(key) ?? {
        speciesKey: key,
        label: entry.cientifico,
        categories: new Set<Categoria>(),
        names: new Set<string>(),
      };
      for (const category of entry.categorias) found.categories.add(category);
      for (const name of entry.nombres ?? []) found.names.add(name);
      resolved.set(key, found);
    }
    return resolved;
  }

  private async saveCategoriesAndNames(
    items: ResolvedSpecies[],
    stats: CultivosStats,
  ) {
    const prisma = this.prisma!;
    const source = await prisma.source.upsert({
      where: { externalId: CATALOG_SOURCE_ID },
      create: {
        externalId: CATALOG_SOURCE_ID,
        name: 'Catálogo de cultivos de Siembra Abierta',
        url: 'https://github.com/JuanBau514/siembra-abierta',
        licenseCode: 'ODbL-1.0',
        citation:
          'Siembra Abierta. Catálogo curado de plantas cultivadas en Colombia. Pendiente de revisión por agrónomos y botánicos.',
      },
      update: {},
    });
    const rows = await prisma.species.findMany({
      where: { gbifKey: { in: items.map((i) => i.speciesKey) } },
      select: { id: true, gbifKey: true },
    });
    const idByKey = new Map(rows.map((r) => [r.gbifKey!, r.id]));

    for (const item of items) {
      const speciesId = idByKey.get(item.speciesKey);
      if (!speciesId) {
        this.log(`  ✗ no se importó la especie ${item.label}; sin categorías`);
        continue;
      }
      const categories = await prisma.speciesCategory.createMany({
        data: [...item.categories].map((categoryCode) => ({
          speciesId,
          categoryCode,
          sourceId: source.id,
        })),
        skipDuplicates: true,
      });
      stats.categoriesSaved += categories.count;
      const names = await prisma.commonName.createMany({
        data: [...item.names].map((name) => ({
          name: cleanDisplayName(name),
          nameNormalized: normalizeText(name),
          languageCode: 'es',
          countryCode: COUNTRY,
          speciesId,
          sourceId: source.id,
        })),
        skipDuplicates: true,
      });
      stats.catalogNamesSaved += names.count;
    }
  }

  /** Fotos con licencia abierta: primero las tomadas en Colombia y luego las de cualquier país. */
  private async importImages(
    items: ResolvedSpecies[],
    options: CultivosOptions,
    stats: CultivosStats,
  ) {
    const prisma = this.prisma;
    const idByKey = new Map<number, string>();
    /** Fotos que la especie ya tiene: no se repiten y solo se completa hasta el máximo. */
    const existingByKey = new Map<number, string[]>();
    let sourceId = 'dry-run';
    if (prisma && !options.dryRun) {
      const rows = await prisma.species.findMany({
        where: { gbifKey: { in: items.map((i) => i.speciesKey) } },
        select: {
          id: true,
          gbifKey: true,
          images: { select: { url: true } },
        },
      });
      for (const r of rows)
        if (r.images.length < options.imagesPerSpecies) {
          idByKey.set(r.gbifKey!, r.id);
          existingByKey.set(
            r.gbifKey!,
            r.images.map((i) => i.url),
          );
        }
      sourceId = (
        await prisma.source.findUniqueOrThrow({
          where: { externalId: OCCURRENCES_SOURCE_ID },
        })
      ).id;
    }
    const todo =
      options.dryRun || !prisma
        ? items
        : items.filter((i) => idByKey.has(i.speciesKey));
    this.log(`Buscando fotos para ${todo.length} especies…`);

    let done = 0;
    await pool(todo, options.concurrency, async (item) => {
      try {
        const have = existingByKey.get(item.speciesKey) ?? [];
        const images = await this.findImages(
          item.speciesKey,
          options.imagesPerSpecies - have.length,
          new Set(have),
          stats,
        );
        if (images.length === 0) stats.speciesWithoutImages.push(item.label);
        stats.imagesSaved += images.length;
        const speciesId = idByKey.get(item.speciesKey);
        if (prisma && !options.dryRun && speciesId && images.length > 0) {
          for (const c of new Set(
            images.map((i) => i.countryCode).filter((c): c is string => !!c),
          ))
            await prisma.country.upsert({
              where: { isoCode: c },
              create: {
                isoCode: c,
                name:
                  new Intl.DisplayNames(['es'], { type: 'region' }).of(c) ?? c,
              },
              update: {},
            });
          await prisma.image.createMany({
            data: images.map((image, index) => ({
              speciesId,
              url: image.url,
              thumbnailUrl: image.thumbnailUrl,
              pageUrl: image.pageUrl,
              author: image.author,
              licenseCode: image.license,
              countryCode: image.countryCode,
              position: have.length + index,
              sourceId,
            })),
            skipDuplicates: true,
          });
        }
      } catch (error) {
        this.log(
          `  ✗ fotos de ${item.label}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (++done % 25 === 0 || done === todo.length)
        this.log(
          `  … fotos ${done}/${todo.length} · ${stats.imagesSaved} imágenes`,
        );
    });
  }

  private async findImages(
    speciesKey: number,
    max: number,
    exclude: Set<string>,
    stats: CultivosStats,
  ) {
    const fresh = (list: ImageCandidate[]) =>
      list.filter((c) => !exclude.has(c.url));
    const local = fresh(
      pickImages(
        await this.gbif.imageOccurrences(speciesKey, COUNTRY, 40),
        max + exclude.size,
      ),
    ).slice(0, max);
    const verified = await this.keepReachable(local, stats);
    if (verified.length >= max) return verified.slice(0, max);
    const global = fresh(
      pickImages(
        await this.gbif.imageOccurrences(speciesKey, null, 100),
        max * 3 + exclude.size,
      ),
    );
    const taken = new Set(verified.map((v) => v.url));
    const more = await this.keepReachable(
      global.filter((g) => !taken.has(g.url)).slice(0, max * 2),
      stats,
    );
    return [...verified, ...more].slice(0, max);
  }

  /** Descarta enlaces rotos: una foto que no carga no sirve en una ficha. */
  private async keepReachable(
    candidates: ImageCandidate[],
    stats: CultivosStats,
  ) {
    const ok: ImageCandidate[] = [];
    for (const candidate of candidates) {
      let reason: string;
      try {
        const response = await fetch(candidate.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(20000),
        });
        const type = response.headers.get('content-type') ?? '';
        if (response.ok && type.startsWith('image/')) {
          ok.push(candidate);
          continue;
        }
        reason = `HTTP ${response.status} ${type}`;
      } catch (error) {
        reason = error instanceof Error ? error.name : String(error);
      }
      stats.imagesRejectedDead++;
      if (stats.imagesRejectedDead <= 15)
        this.log(`  · enlace descartado (${reason}): ${candidate.url}`);
    }
    return ok;
  }
}
