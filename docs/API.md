# Guía de la API

Siembra Abierta expone una API **GraphQL**. Es pública y de lectura; por ahora no
requiere clave. Todo lo que devuelve es de licencia abierta (ver [Atribución](#atribución)).

| | |
|---|---|
| Endpoint GraphQL | `POST http://localhost:3000/graphql` |
| Estado del servicio | `GET http://localhost:3000/health` |
| Referencia completa (tipos y campos) | [api/REFERENCE.md](api/REFERENCE.md) |
| Esquema en formato SDL | [api/schema.graphql](api/schema.graphql) |

## Levantar la API en local

```bash
pnpm install
cp .env.example .env
pnpm db:up && pnpm exec prisma migrate deploy
pnpm import:gbif --country CO --limit 30   # carga datos de ejemplo
pnpm start:dev
```

## Probar la API sin escribir código

**GraphiQL (en el navegador).** Con la API en marcha, abre
<http://localhost:3000/graphql>. Verás un explorador interactivo con autocompletado y
el panel **Docs** (arriba a la izquierda), que muestra la documentación de cada consulta,
tipo y campo. Necesita conexión a internet porque carga sus scripts desde un CDN.

**Bruno, Insomnia o Postman.** Crea una petición GraphQL a
`http://localhost:3000/graphql`. La herramienta carga el esquema por introspección.
También puedes importar [api/schema.graphql](api/schema.graphql).

**Archivo `.http`.** [api/examples.http](api/examples.http) se ejecuta directo en
VS Code (extensión REST Client) o en los IDE de JetBrains.

## Ejemplos

### curl

```bash
curl -s http://localhost:3000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ searchSpecies(query: \"almacigo\", limit: 3) { canonicalName family commonNames { name } } }"}'
```

### Con variables (recomendado)

```bash
curl -s http://localhost:3000/graphql \
  -H 'content-type: application/json' \
  -d '{
    "query": "query Buscar($q: String!, $n: Int) { searchSpecies(query: $q, limit: $n) { canonicalName distributions { countryIso minElevationM maxElevationM } } }",
    "variables": { "q": "almácigo", "n": 3 }
  }'
```

### JavaScript / TypeScript (web, React Native)

```ts
const res = await fetch('http://localhost:3000/graphql', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    query: `query ($q: String!) { searchSpecies(query: $q) { canonicalName family } }`,
    variables: { q: 'almácigo' },
  }),
});
const { data, errors } = await res.json();
```

### Python

```python
import requests

r = requests.post(
    "http://localhost:3000/graphql",
    json={
        "query": "query($c: String!) { invasiveSpecies(countryIso: $c) { riskLevel species { canonicalName } } }",
        "variables": {"c": "CO"},
    },
)
print(r.json()["data"])
```

### Apps Android, iOS y dispositivos

Cualquier cliente que envíe un `POST` con JSON funciona (Raspberry Pi incluida).
Para apps móviles puedes generar los tipos automáticamente desde
[api/schema.graphql](api/schema.graphql) con Apollo Kotlin (Android), Apollo iOS (Swift)
o GraphQL Code Generator (TypeScript).

## Búsqueda

`searchSpecies` ignora mayúsculas y acentos y busca en el nombre científico y en los
nombres comunes: `almacigo`, `ALMÁCIGO` y `Bursera simaruba` encuentran la misma especie.

## Frutas, hortalizas, cultivos y flores

`speciesByCategory` lista las plantas cultivadas de una categoría (`FRUIT`, `VEGETABLE`,
`CROP`, `FLOWER`) en un país (`CO` por defecto), en orden alfabético. Se pagina con
`limit` (1 a 50) y `offset`.

```graphql
query Frutas($offset: Int) {
  speciesByCategory(category: FRUIT, countryIso: "CO", limit: 20, offset: $offset) {
    displayName(countryIso: "CO")   # "Lulo", "Uchuva"... o el nombre científico
    canonicalName
    categoryLabels                  # ["Frutas"] según el idioma de la respuesta
    primaryImage { thumbnailUrl url author license licenseUrl pageUrl }
    images { url author license }
  }
}
```

**Las imágenes exigen atribución.** Cada una trae `author` y `license` (CC0-1.0 o
CC-BY-4.0): muéstralos junto a la foto, con enlace a `licenseUrl`. Las fotos se sirven
desde su origen (el campo `url`); la API entrega el enlace, no el archivo. Una especie
sin fotos abiertas devuelve `primaryImage: null`.

## Idioma de la respuesta

La API entrega la información ya preparada en el idioma que pidas: **español (`es`) por
defecto** e inglés (`en`). Se elige con el encabezado estándar `Accept-Language` o con el
parámetro `?lang=` (este último tiene prioridad):

```bash
curl -s 'http://localhost:3000/graphql?lang=en' \
  -H 'content-type: application/json' \
  -d '{"query":"{ invasiveSpecies(countryIso: \"CO\") { statusLabel riskLabel } }"}'
# → "Invasive", "High risk".  Con lang=es → "Invasora", "Riesgo alto"
```

Qué cambia con el idioma:

| Campo | Comportamiento |
|---|---|
| `statusLabel`, `riskLabel`, `verificationLabel` | Texto del valor en el idioma pedido. Los campos `status`, `riskLevel` y `verification` siguen devolviendo el código estable (`INVASIVE`, `HIGH`...). |
| `Species.displayName(countryIso)` | El nombre común en ese idioma (con preferencia por el del país indicado) o, si no existe, el nombre científico. |
| `Species.commonNames(language)` | Todos los nombres, o solo los del idioma indicado (`es`, `en`). |

El **nombre científico no se traduce**. Los nombres comunes se guardan por idioma y
solo se importan los que la fuente publica en ese idioma; hoy son casi todos en español.
Agregar otro idioma de etiquetas es agregar una entrada en `src/i18n/i18n.ts`.

## Límites

La API protege a todos los usuarios de consultas muy pesadas:

| Límite | Valor | Se configura con |
|---|---|---|
| Profundidad máxima de la consulta | 8 niveles | `GRAPHQL_MAX_DEPTH` |
| Costo máximo estimado | 1000 | `GRAPHQL_MAX_COMPLEXITY` |
| Resultados por consulta (`limit`) | 1 a 50 (si pides más, se ajusta a 50) | fijo |

Si superas un límite recibes un error y no se ejecuta nada.

## Errores

GraphQL responde con código HTTP 200 y un arreglo `errors` cuando algo falla:

```json
{ "errors": [{ "message": "La consulta tiene profundidad 10; el máximo permitido es 8.",
               "extensions": { "code": "GRAPHQL_VALIDATION_FAILED" } }] }
```

| `extensions.code` | Significa |
|---|---|
| `GRAPHQL_VALIDATION_FAILED` | La consulta es inválida (campo inexistente, argumento con tipo incorrecto) o supera la profundidad máxima. |
| `QUERY_TOO_COMPLEX` | La consulta supera el costo máximo. |
| `INTERNAL_SERVER_ERROR` | Error del servidor. |

## Atribución

Los datos provienen de fuentes con licencia **CC0 o CC-BY 4.0**. CC-BY exige dar
crédito: si publicas datos de esta API, cita "Siembra Abierta" y a GBIF y las fuentes
indicadas. Ver [DATA_LICENSE.md](../DATA_LICENSE.md). Más adelante la API expondrá la
fuente y la licencia de cada dato.

## Cómo se mantiene esta documentación

`docs/api/REFERENCE.md`, `docs/api/schema.graphql` y `docs/database/SCHEMA.md` se
**generan** automáticamente con `pnpm docs:generate`. La integración continua falla
(`pnpm docs:check`) si cambias la API o el esquema de la base de datos sin
regenerarlos. Los comentarios `///` de `prisma/schema.prisma` y las descripciones de
`@Field` y `@Args` en el código son la fuente de esas descripciones.
