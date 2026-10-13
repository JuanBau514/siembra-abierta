# Importador de GBIF

Carga especies de plantas, nombres comunes en español y rango de altitud desde la
[API pública de GBIF](https://api.gbif.org/v1) (no requiere clave).

```bash
pnpm db:up && pnpm exec prisma migrate deploy
pnpm import:gbif --country CO --limit 50 --dry-run   # simula, no escribe
pnpm import:gbif --country CO --limit 50             # importa las 50 más registradas
pnpm import:gbif --country CO --limit 200000 --basis ALL --concurrency 6 --skip-existing   # todo el país
```

| Opción | Qué hace |
|---|---|
| `--country` | País, código ISO 3166-1 alfa-2 (por defecto `CO`) |
| `--limit` | Máximo de especies (1 a 200000) |
| `--basis` | Tipo de registro de GBIF: `HUMAN_OBSERVATION` (por defecto) o `ALL` |
| `--languages` | Idiomas de nombres comunes, ISO 639-3 (por defecto `spa`) |
| `--concurrency` | Especies procesadas a la vez (1 a 16, por defecto 4) |
| `--skip-existing` | Omite las especies ya importadas para el país: sirve para reanudar |
| `--dry-run` | Simula sin escribir en la base de datos |

El importador es idempotente: se puede ejecutar varias veces sin duplicar datos. Una
sola especie que falle no detiene la carga; al final lista las fallidas y se reintentan
ejecutando de nuevo con `--skip-existing`.

Hacia GBIF respeta un máximo de unas 10 peticiones por segundo en total, sin importar
la concurrencia, y reintenta con espera ante errores 429 o 5xx. Importar todo un país
toma varias horas.

`--basis HUMAN_OBSERVATION` favorece plantas que la gente ve y fotografía (parques,
casas, calles); `--basis ALL` incluye también especímenes de herbario y otros registros.

## De dónde sale cada dato

| Dato | Endpoint de GBIF | Va a |
|---|---|---|
| Especies del país con registros abiertos | `GET /occurrence/search?country=CO&taxonKey=6&license=CC0_1_0&license=CC_BY_4_0&facet=speciesKey` | lista de candidatas y `especies_paises.num_registros` |
| Taxonomía | `GET /species/{key}` | `familias`, `generos`, `especies` |
| Nombres comunes | `GET /species/{key}/vernacularNames` | `nombres_comunes` |
| Licencia de cada nombre | `GET /species/{sourceTaxonKey}` → `datasetKey` → `GET /dataset/{key}` | `fuentes` |
| Altitud (si hay 20 o más registros) | `GET /occurrence/search?...&elevation=0,6500&limit=300` | `especies_paises` |

## Mapeo de campos

| GBIF | Tabla.columna |
|---|---|
| `family` | `familias.nombre` |
| `genus` | `generos.nombre` (con `familia_id`) |
| `canonicalName` sin el género | `especies.epiteto` |
| `scientificName` sin el canónico | `especies.autoria` |
| `key` | `especies.clave_gbif` |
| `vernacularName` | `nombres_comunes.nombre` |
| `language` (spa) | `nombres_comunes.idioma_codigo` (es) |
| `country` (si existe) | `nombres_comunes.pais_codigo` (si no, `null`) |
| `datasetKey` | `fuentes.id_externo` |
| licencia del dataset | `fuentes.licencia_codigo` → `licencias` |
| conteo de la faceta | `especies_paises.num_registros` |
| percentil 5 y 95 de `elevation` | `especies_paises.altitud_min_m`, `altitud_max_m` |

Los países y los idiomas son tablas de referencia: se crean la primera vez que
aparecen, con su nombre en español.

## Normalización de los datos

Las funciones están en `src/importers/gbif/normalize.ts`:

- Solo especies **aceptadas** de rango `SPECIES` y reino Plantae. Sinónimos y
  rangos inferiores se omiten.
- El nombre científico se descompone en género, epíteto y autoría; el nombre completo
  se arma al leerlo (`género + epíteto`), no se guarda repetido.
- Nombres comunes: se guarda el original (`nombre`) y una versión sin acentos, en
  minúsculas y sin espacios dobles (`nombre_normalizado`), que usa la búsqueda.
- Campos con varios nombres ("A | B | C") se separan en filas, sin repetidos.
- Idioma ISO 639-3 → 639-1 (`spa` → `es`). País solo si la fuente lo da; **nunca se supone**.
- Licencia → `CC0-1.0` o `CC-BY-4.0`. Cualquier otra se rechaza.
- Altitud: se descartan valores imposibles (< -50 o > 6500 m) y se exigen al menos
  20 registros. Se guardan los percentiles 5 y 95, no el mínimo y el máximo, porque
  un solo error de captura arruinaría el rango.

La normalización de la base de datos (tercera forma normal) está explicada en
[DATABASE.md](DATABASE.md).

## Licencias

- Solo se importan datos con licencia **CC0 o CC-BY**. Los registros de ocurrencias se
  filtran en la propia consulta, y cada nombre común se verifica contra la licencia de su
  dataset. Por ejemplo, se excluye un listado CC-BY-NC de Barranquilla.
- La taxonomía de GBIF (Backbone) es **CC-BY 4.0**: exige atribución. Por eso la atribución
  debe mostrarse en la API y en los productos derivados.
- No se importan usos medicinales ni rituales (ver `CONTENT_POLICY.md`). Aunque
  algunos datasets de GBIF traen información de usos, el importador solo toma nombres.

## Pendientes conocidos

- Muchos nombres comunes de GBIF (Catalogue of Life) no indican país: quedan con
  `pais_codigo = null` y pueden ser de otro país de la región.
- Para citar datos de forma rigurosa, GBIF recomienda descargas con DOI. Esto sirve
  para el MVP; antes de un lanzamiento público conviene citar con DOI.
- Falta cruzar con listas oficiales de especies invasoras (ver `README`).
