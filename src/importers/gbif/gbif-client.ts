const BASE_URL = 'https://api.gbif.org/v1';
/** Filtros de licencia de GBIF que admite el proyecto. */
export const OPEN_LICENSE_PARAMS = 'license=CC0_1_0&license=CC_BY_4_0';
const PLANTAE_KEY = 6;

export interface GbifSpecies {
  key: number;
  scientificName: string;
  canonicalName?: string;
  rank: string;
  taxonomicStatus: string;
  kingdom?: string;
  genus?: string;
  family?: string;
  datasetKey: string;
}

export interface GbifVernacularName {
  vernacularName: string;
  language?: string;
  country?: string;
  source?: string;
  sourceTaxonKey?: number;
}

export interface GbifDataset {
  key: string;
  title: string;
  license?: string;
  citation?: { text?: string };
}

export interface GbifMatch {
  matchType: string;
  rank?: string;
  status?: string;
  speciesKey?: number;
  usageKey?: number;
  acceptedUsageKey?: number;
}

export interface GbifMedia {
  type?: string;
  identifier?: string;
  references?: string;
  license?: string;
  creator?: string;
  rightsHolder?: string;
}

export interface GbifImageOccurrence {
  key: number;
  countryCode?: string;
  media?: GbifMedia[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GbifClient {
  private nextSlotAt = 0;
  constructor(private readonly minIntervalMs = 100) {}

  /** Reserva un turno: garantiza un intervalo mínimo entre peticiones, aunque haya varias en paralelo. */
  private async waitForSlot() {
    const now = Date.now();
    const start = Math.max(now, this.nextSlotAt);
    this.nextSlotAt = start + this.minIntervalMs;
    if (start > now) await sleep(start - now);
  }

  /** GET con espera mínima entre peticiones y reintentos ante 429/5xx. */
  private async get<T>(path: string): Promise<T> {
    for (let attempt = 1; attempt <= 6; attempt++) {
      await this.waitForSlot();
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'siembra-abierta-importer',
        },
      });
      if (response.ok) return (await response.json()) as T;
      if (response.status === 429 || response.status >= 500) {
        await sleep(1000 * 2 ** Math.min(attempt, 5));
        continue;
      }
      throw new Error(`GBIF ${response.status} en ${path}`);
    }
    throw new Error(`GBIF no respondió tras varios intentos: ${path}`);
  }

  /** Especies de plantas más registradas en un país, solo con datos de licencia abierta. */
  async topPlantSpecies(
    country: string,
    limit: number,
    basisOfRecord: string | null,
  ) {
    const data = await this.get<{
      facets: { counts: { name: string; count: number }[] }[];
    }>(
      `/occurrence/search?country=${country}&taxonKey=${PLANTAE_KEY}` +
        `${basisOfRecord ? `&basisOfRecord=${basisOfRecord}` : ''}&${OPEN_LICENSE_PARAMS}` +
        `&limit=0&facet=speciesKey&facetLimit=${limit}`,
    );
    return (data.facets[0]?.counts ?? []).map((c) => ({
      speciesKey: Number(c.name),
      occurrenceCount: c.count,
    }));
  }

  species(key: number) {
    return this.get<GbifSpecies>(`/species/${key}`);
  }

  async vernacularNames(key: number) {
    const data = await this.get<{ results: GbifVernacularName[] }>(
      `/species/${key}/vernacularNames?limit=200`,
    );
    return data.results;
  }

  dataset(key: string) {
    return this.get<GbifDataset>(`/dataset/${key}`);
  }

  /** Muestra de altitudes de registros abiertos de una especie en un país. */
  async elevations(country: string, speciesKey: number, sample = 300) {
    const data = await this.get<{ results: { elevation?: number }[] }>(
      `/occurrence/search?country=${country}&speciesKey=${speciesKey}` +
        `&elevation=0,6500&${OPEN_LICENSE_PARAMS}&limit=${sample}`,
    );
    return data.results
      .map((r) => r.elevation)
      .filter((v): v is number => typeof v === 'number');
  }

  /** Busca un nombre científico de planta en el Backbone de GBIF. */
  matchSpecies(name: string) {
    return this.get<GbifMatch>(
      `/species/match?kingdom=Plantae&name=${encodeURIComponent(name)}`,
    );
  }

  /** Registros abiertos (CC0/CC-BY) de una especie en un país. */
  async occurrenceCount(country: string, speciesKey: number) {
    const data = await this.get<{ count: number }>(
      `/occurrence/search?country=${country}&speciesKey=${speciesKey}&${OPEN_LICENSE_PARAMS}&limit=0`,
    );
    return data.count;
  }

  /**
   * Observaciones con fotos de una especie (no de especímenes de herbario).
   * La licencia de cada foto puede ser distinta a la del registro: quien llama debe revisarla.
   */
  async imageOccurrences(
    speciesKey: number,
    country: string | null,
    limit: number,
  ) {
    const data = await this.get<{ results: GbifImageOccurrence[] }>(
      `/occurrence/search?speciesKey=${speciesKey}&mediaType=StillImage` +
        `&basisOfRecord=HUMAN_OBSERVATION&${OPEN_LICENSE_PARAMS}` +
        `${country ? `&country=${country}` : ''}&limit=${limit}`,
    );
    return data.results;
  }
}
