# Importador de GBIF

Carga especies de plantas, nombres comunes en español y rango de altitud desde la
[API pública de GBIF](https://api.gbif.org/v1) (no requiere clave).

```bash
pnpm db:up && pnpm exec prisma migrate deploy
pnpm import:gbif --country CO --limit 50            # importa
pnpm import:gbif --country CO --limit 50 --dry-run  # simula, no escribe
```

Opciones: `--country` (ISO-2), `--limit` (1–1000), `--basis` (por defecto
`HUMAN_OBSERVATION`), `--languages` (ISO 639-3, por defecto `spa`).
Es idempotente: se puede ejecutar varias veces sin duplicar datos.

## De dónde sale cada dato

| Dato | Endpoint de GBIF | Va a |
|---|---|---|
| Especies más registradas del país | `GET /occurrence/search?country=CO&taxonKey=6&basisOfRecord=HUMAN_OBSERVATION&license=CC0_1_0&license=CC_BY_4_0&facet=speciesKey` | lista de candidatas y `species_countries.occurrenceCount` |
| Taxonomía | `GET /species/{key}` | `species` |
| Nombres comunes | `GET /species/{key}/vernacularNames` | `common_names` |
| Licencia de cada nombre | `GET /species/{sourceTaxonKey}` → `datasetKey` → `GET /dataset/{key}` | `sources` |
| Altitud | `GET /occurrence/search?...&elevation=0,6500&license=...&limit=300` | `species_countries` |

`basisOfRecord=HUMAN_OBSERVATION` favorece plantas que la gente ve y fotografía
(parques, casas, calles) frente a especímenes de herbario.

## Mapa de tablas

```
sources ─┬─< species >─┬─< species_countries   (especie × país: registros y altitud)
         │             ├─< common_names        (nombres, con idioma, país y fuente)
         │             ├─< invasion_statuses   (nativa / introducida / invasora, por lugar)
         │             └─< care_observations   (experiencias de cuidado, por la comunidad)
         └─ cada fila de datos apunta a su fuente y licencia
```

| GBIF | Tabla.columna |
|---|---|
| `canonicalName` | `species.canonicalName` (clave natural, única) |
| `scientificName` | `species.scientificName` (con autoría) |
| `genus`, `family` | `species.genus`, `species.family` |
| `key` | `species.gbifKey` |
| `vernacularName` | `common_names.name` |
| `language` (spa) | `common_names.language` (es) |
| `country` (si existe) | `common_names.countryIso` (si no, `null`) |
| `datasetKey` + `license` | `sources.externalId`, `sources.license` |
| conteo de la faceta | `species_countries.occurrenceCount` |
| percentil 5 y 95 de `elevation` | `species_countries.minElevationM`, `maxElevationM` |

## Normalización

**De los datos** (`src/importers/gbif/normalize.ts`):

- Solo especies **aceptadas** de rango `SPECIES` y reino Plantae. Sinónimos y
  rangos inferiores se omiten.
- Nombres: se guarda el original (`name`) y una versión sin acentos, en minúsculas y
  sin espacios dobles (`nameNormalized`). La búsqueda usa la segunda: "almacigo"
  encuentra "Almácigo".
- Campos con varios nombres ("A | B | C") se separan en filas, sin repetidos.
- Idioma ISO 639-3 → 639-1 (`spa` → `es`). País solo si la fuente lo da; **nunca se supone**.
- Licencia → `CC0-1.0` o `CC-BY-4.0`. Cualquier otra se rechaza.
- Altitud: se descartan valores imposibles (< -50 o > 6500 m) y se exigen al menos
  20 registros. Se guardan los percentiles 5 y 95, no el mínimo y el máximo, porque
  un solo error de captura arruinaría el rango.

**De la base de datos:**

- La altitud vive en `species_countries`, no en `species`, porque depende del país.
- Las fuentes viven en `sources` y se referencian, no se repiten como texto.
- `genus` y `family` están como texto en `species` a propósito: es una
  desnormalización controlada (la taxonomía casi no cambia y simplifica las consultas).
  Si hace falta, se pasa a tablas de taxones o al grafo más adelante.

## Licencias

- Solo se importan datos con licencia **CC0 o CC-BY**. Los registros de ocurrencias se
  filtran en la propia consulta, y cada nombre común se verifica contra la licencia de su
  dataset. En una prueba real se excluyó, por ejemplo, un listado CC-BY-NC.
- La taxonomía de GBIF (Backbone) es **CC-BY 4.0**: exige atribución. Por eso la atribución
  debe mostrarse en la API y en los productos derivados.
- No se importan usos medicinales ni rituales (ver `CONTENT_POLICY.md`). Aunque
  algunos datasets de GBIF traen información de usos, el importador solo toma nombres.

## Pendientes conocidos

- Muchos nombres comunes de GBIF (Catalogue of Life) no indican país: quedan con
  `countryIso = null` y pueden ser de otro país de la región.
- Para citar datos de forma rigurosa, GBIF recomienda descargas con DOI. Esto sirve
  para el MVP; antes de un lanzamiento público conviene citar con DOI.
- Falta cruzar con listas oficiales de especies invasoras (ver `README`).
