# Siembra Abierta

API y base de datos **abiertas** para el cuidado de plantas nativas de Latinoamérica
(inicio: Colombia, Ecuador, Panamá y Venezuela), en español, hechas por la comunidad.

**Objetivo:** que cualquier persona pueda cuidar sus plantas en casas, parques y
huertas urbanas, con recomendaciones que tengan en cuenta la altitud, el clima y las
condiciones reales de los Andes y de la región, y que cuenten con verificación científica.

> Estado: setup inicial. La API arranca y responde, pero todavía no hay datos cargados.

## Stack

NestJS 12 · GraphQL (Apollo) · Prisma 7 · PostgreSQL 17 · **solo pnpm**
(npm, yarn y bun están bloqueados).

## Empezar

Requisitos: Node.js 24+, pnpm 12+ y Docker.

```bash
corepack enable && corepack prepare pnpm@latest --activate   # si no tienes pnpm
pnpm install
cp .env.example .env
pnpm db:up                 # PostgreSQL con Docker
pnpm prisma:migrate        # crea las tablas
pnpm start:dev             # http://localhost:3000/graphql
```

Comprobaciones: `pnpm lint`, `pnpm test`, `pnpm build`. Estado del servicio: `GET /health`.

La API limita la profundidad (`GRAPHQL_MAX_DEPTH`) y el costo
(`GRAPHQL_MAX_COMPLEXITY`) de las consultas GraphQL para protegerla.

## Principios

1. **Abierto y comunitario.** Todo el código y los datos son libres. Cualquier persona
   técnica puede aportar.
2. **Verificado.** Cada dato muestra su estado: `reportado`, `corroborado` o
   `verificado por experto`, y cuántas observaciones lo respaldan.
3. **Conservación primero.** Las ubicaciones de especies amenazadas se generalizan.
4. **Sin información medicinal ni ritual. Nunca.** Ver [CONTENT_POLICY.md](CONTENT_POLICY.md).
5. **Sin ánimo de lucro por reparto de ganancias.** El proyecto se sostiene con
   donaciones voluntarias. Ver [GOVERNANCE.md](GOVERNANCE.md).

## Licencias

| Qué | Licencia |
|---|---|
| Código | [GNU AGPL-3.0](LICENSE), con el aviso de autoría de [NOTICE](NOTICE) |
| Base de datos | ODbL 1.0, ver [DATA_LICENSE.md](DATA_LICENSE.md) |
| Textos y fotos aportados | CC-BY-SA 4.0 |

Quien use el proyecto debe dar crédito y compartir bajo las mismas condiciones sus
modificaciones, incluso si las ofrece como servicio en red.

## Cómo aportar

Ver [CONTRIBUTING.md](CONTRIBUTING.md).
