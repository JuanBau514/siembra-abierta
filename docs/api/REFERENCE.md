# Referencia de la API GraphQL

> Documento **generado** desde el esquema real de la API. No lo edites a mano:
> cambia el código y ejecuta `pnpm docs:generate`.

Cómo conectarte y ejemplos de uso: [API.md](../API.md). Esquema en formato SDL: [`schema.graphql`](schema.graphql).

## Consultas (Query)

### invasiveSpecies

Especies invasoras registradas en un país (código ISO, p. ej. CO).

Devuelve: [`[InvasionStatus!]!`](#invasionstatus)

| Argumento | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `countryIso` | `String!` (obligatorio) |  | País, código ISO 3166-1 alfa-2 (CO, EC, PA, VE). |
| `limit` | `Int!` | `20` | Máximo de resultados (1 a 50). |

```graphql
{ invasiveSpecies(countryIso: "CO", limit: 20) { countryIso id impact management } }
```

### searchSpecies

Busca por nombre científico o nombre común.

Devuelve: [`[Species!]!`](#species)

| Argumento | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `limit` | `Int!` | `20` | Máximo de resultados (1 a 50). |
| `query` | `String!` (obligatorio) |  | Texto a buscar. Ignora mayúsculas y acentos. |

```graphql
{ searchSpecies(limit: 20, query: "almácigo") { canonicalName categories categoryLabels displayName } }
```

### species

Una especie por su id.

Devuelve: [`Species`](#species)

| Argumento | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `id` | `ID!` (obligatorio) |  | Identificador de la especie. |

```graphql
{ species(id: "ID") { canonicalName categories categoryLabels displayName } }
```

### speciesByCategory

Especies de una categoría (frutas, hortalizas, cultivos, flores) en un país, en orden alfabético.

Devuelve: [`[Species!]!`](#species)

| Argumento | Tipo | Por defecto | Descripción |
|---|---|---|---|
| `category` | [`PlantCategory!`](#plantcategory) (obligatorio) |  | Categoría de uso. |
| `countryIso` | `String!` | `"CO"` | País, código ISO 3166-1 alfa-2. Por defecto CO. |
| `limit` | `Int!` | `20` | Máximo de resultados (1 a 50). |
| `offset` | `Int!` | `0` | Cuántos resultados saltar, para paginar. |

```graphql
{ speciesByCategory(category: "almácigo", countryIso: "CO", limit: 20, offset: 0) { canonicalName categories categoryLabels displayName } }
```

## Tipos

### CommonName

Nombre común de una especie, con su idioma y país.

| Campo | Tipo | Descripción |
|---|---|---|
| `countryIso` | `String` | País (ISO 3166-1 alfa-2) solo si la fuente lo indica; null si se desconoce. |
| `id` | `ID!` | Identificador del nombre. |
| `language` | `String!` | Idioma, código ISO 639-1 (es, en...). |
| `name` | `String!` | Nombre tal como se muestra al usuario. |
| `region` | `String` | Región, si se conoce. |

### InvasionStatus

Estatus de una especie en un lugar. Una especie puede ser invasora en un piso térmico y no en otro.

| Campo | Tipo | Descripción |
|---|---|---|
| `countryIso` | `String!` | País, código ISO 3166-1 alfa-2. |
| `id` | `ID!` | Identificador del registro. |
| `impact` | `String` | Daño que causa al ecosistema. |
| `management` | `String` | Recomendación de manejo o control. |
| `maxElevationM` | `Int` | Altitud máxima donde aplica el estatus (m s. n. m.). |
| `minElevationM` | `Int` | Altitud mínima donde aplica el estatus (m s. n. m.). |
| `region` | `String` | Región, si aplica. |
| `riskLabel` | `String` | Nivel de riesgo en el idioma de la respuesta. |
| `riskLevel` | [`RiskLevel`](#risklevel) | Riesgo ecológico, si se conoce. |
| `species` | [`Species`](#species) | Especie afectada. |
| `status` | [`OriginStatus!`](#originstatus) | Nativa, introducida o invasora. |
| `statusLabel` | `String!` | Estatus en el idioma de la respuesta (Nativa, Introducida, Invasora). |
| `verification` | [`VerificationStatus!`](#verificationstatus) | Nivel de verificación del dato. |
| `verificationLabel` | `String!` | Nivel de verificación en el idioma de la respuesta. |

### Species

Especie de planta aceptada (sin sinónimos).

| Campo | Tipo | Descripción |
|---|---|---|
| `canonicalName` | `String!` | Nombre científico sin autoría. Es único. |
| `categories` | [`[PlantCategory!]!`](#plantcategory) | Categorías de uso: fruta, hortaliza, cultivo, flor. |
| `categoryLabels` | `[String!]!` | Categorías en el idioma de la respuesta (p. ej. "Frutas" o "Fruits"). |
| `commonNames` | [`[CommonName!]!`](#commonname) | Nombres comunes conocidos. Con `language` solo devuelve los de ese idioma (es, en). |
| `displayName` | `String!` | Nombre listo para mostrar: el nombre común en el idioma de la respuesta (preferido el del país indicado) o, si no hay, el nombre científico. |
| `distributions` | [`[SpeciesCountry!]!`](#speciescountry) | Países donde se registra y su rango de altitud. |
| `family` | `String` | Familia botánica. |
| `genus` | `String` | Género. |
| `id` | `ID!` | Identificador de la especie. |
| `images` | [`[SpeciesImage!]!`](#speciesimage) | Fotografías con licencia abierta. La primera es la principal. |
| `invasionStatuses` | [`[InvasionStatus!]!`](#invasionstatus) | Estatus nativa/introducida/invasora por lugar. |
| `primaryImage` | [`SpeciesImage`](#speciesimage) | Imagen principal, o null si la especie no tiene fotos abiertas. |
| `scientificName` | `String!` | Nombre científico con autoría. |

### SpeciesCountry

Presencia de una especie en un país y su rango de altitud.

| Campo | Tipo | Descripción |
|---|---|---|
| `countryIso` | `String!` | País, código ISO 3166-1 alfa-2 (CO, EC, PA, VE). |
| `elevationSampleSize` | `Int` | Registros con altitud usados para calcular el rango. |
| `maxElevationM` | `Int` | Percentil 95 de la altitud observada (m s. n. m.). |
| `minElevationM` | `Int` | Percentil 5 de la altitud observada (m s. n. m.). |
| `occurrenceCount` | `Int!` | Registros abiertos (CC0/CC-BY) de la especie en el país. |

### SpeciesImage

Fotografía de una especie. Cada imagen trae su autoría y su licencia: al mostrarla hay que atribuir.

| Campo | Tipo | Descripción |
|---|---|---|
| `author` | `String!` | Autoría. Debe mostrarse junto a la imagen (CC-BY). |
| `countryIso` | `String` | País donde se tomó, código ISO 3166-1 alfa-2. |
| `id` | `ID!` | Identificador de la imagen. |
| `license` | `String!` | Licencia: CC0-1.0 o CC-BY-4.0. |
| `licenseUrl` | `String!` | Enlace al texto de la licencia. |
| `pageUrl` | `String` | Página de origen de la foto. |
| `thumbnailUrl` | `String` | Enlace a una versión pequeña, para listas y tarjetas. |
| `url` | `String!` | Enlace a la imagen (tamaño grande). |

## Enumeraciones

### OriginStatus

Estatus de una especie en un lugar.

- `INTRODUCED`: Introducida por el ser humano, sin daño documentado.
- `INVASIVE`: Introducida y con daño documentado a ecosistemas locales.
- `NATIVE`: Nativa de la región.

### PlantCategory

Categoría de uso de una planta.

- `CROP`: Cultivos de campo: café, cacao, papa, maíz.
- `FLOWER`: Flores de corte y ornamentales.
- `FRUIT`: Frutas.
- `VEGETABLE`: Hortalizas y verduras (incluye hierbas culinarias).

### RiskLevel

Nivel de riesgo ecológico de una especie invasora.

- `HIGH`: Riesgo alto.
- `LOW`: Riesgo bajo.
- `MEDIUM`: Riesgo medio.

### VerificationStatus

Nivel de verificación de un dato.

- `CORROBORATED`: Varios reportes independientes coinciden.
- `EXPERT_VERIFIED`: Verificado por un experto o una institución.
- `REPORTED`: Reportado por una persona; sin corroborar.
