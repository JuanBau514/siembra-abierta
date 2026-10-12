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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GbifClient {
  private lastRequestAt = 0;
  constructor(private readonly minIntervalMs = 120) {}

  /** GET con espera mínima entre peticiones y reintentos ante 429/5xx. */
  private async get<T>(path: string): Promise<T> {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastRequestAt = Date.now();
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'siembra-abierta-importer',
        },
      });
      if (response.ok) return (await response.json()) as T;
      if (response.status === 429 || response.status >= 500) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new Error(`GBIF ${response.status} en ${path}`);
    }
    throw new Error(`GBIF no respondió tras varios intentos: ${path}`);
  }

  /** Especies de plantas más registradas en un país, solo con datos de licencia abierta. */
  async topPlantSpecies(country: string, limit: number, basisOfRecord: string) {
    const data = await this.get<{
      facets: { counts: { name: string; count: number }[] }[];
    }>(
      `/occurrence/search?country=${country}&taxonKey=${PLANTAE_KEY}` +
        `&basisOfRecord=${basisOfRecord}&${OPEN_LICENSE_PARAMS}` +
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
}
