# Importador de cultivos de Colombia

Carga frutas, hortalizas y verduras, cultivos de campo y flores cultivadas en Colombia,
con su taxonomía, nombres comunes y **fotografías con licencia abierta**.

```bash
pnpm db:up && pnpm exec prisma migrate deploy
pnpm import:cultivos --dry-run                # simula: resuelve nombres y busca fotos, no escribe
pnpm import:cultivos                          # importa todo el catálogo (hasta 4 fotos por especie)
pnpm import:cultivos --images 6               # más fotos por especie
pnpm import:cultivos --skip-images            # solo taxonomía, categorías y nombres
```

Es idempotente: se puede repetir para completar lo que falló (omite las especies ya importadas). Las que ya tienen
el número pedido de fotos se omiten.

## Cómo se decide qué entra

GBIF no clasifica las plantas por uso, así que el criterio es un **catálogo curado**:
[`src/importers/cultivos/catalogo.ts`](../src/importers/cultivos/catalogo.ts). Cada entrada
tiene un nombre científico, una o más categorías y nombres comunes de Colombia.

| Categoría | Código (BD) | Código (API) |
|---|---|---|
| Frutas | `FRUTA` | `FRUIT` |
| Hortalizas y verduras (incluye hierbas culinarias) | `HORTALIZA` | `VEGETABLE` |
| Cultivos de campo | `CULTIVO` | `CROP` |
| Flores | `FLOR` | `FLOWER` |

Una especie puede estar en varias categorías (el tomate es hortaliza y fruta).

Reglas del catálogo (ver [CONTENT_POLICY.md](../CONTENT_POLICY.md)):

- Solo uso alimentario u ornamental. **Nada medicinal ni ritual.**
- Sin especies invasoras en Colombia ni cultivos de uso ilícito.
- El catálogo es obra del equipo del proyecto (licencia ODbL) y está **pendiente de revisión
  por agrónomos o botánicos**. Para agregar una planta, edita el archivo y abre un pull request.

## Flujo

1. Cada nombre del catálogo se busca en el Backbone de GBIF (`/species/match`). Solo se
   aceptan coincidencias exactas; si el nombre es un **sinónimo**, se usa la especie aceptada
   (p. ej. *Citrus sinensis* se guarda como *Citrus × aurantium*, como la trata GBIF).
   Varias entradas pueden dar a la misma especie: se unen sus categorías y nombres.
2. Se importan taxonomía, nombres comunes en español y altitud con el mismo
   código que [IMPORT_GBIF.md](IMPORT_GBIF.md). La especie queda ligada a Colombia aunque
   no tenga registros abiertos allí (`num_registros = 0`).
3. Se guardan las categorías (`especies_categorias`) y los nombres comunes del catálogo
   (`nombres_comunes`, país `CO`, fuente "Catálogo de cultivos de Siembra Abierta").
4. Se buscan fotos (ver abajo).

## Imágenes

Cada foto se guarda en `imagenes` con su autoría, su licencia y el enlace a la página de
origen. **Se guarda el enlace, no el archivo**: la foto se sirve desde su origen
(casi siempre iNaturalist, vía GBIF).

- **La licencia se revisa por foto.** GBIF filtra por la licencia del registro, pero la foto
  puede tener otra (hay fotos `CC BY-NC`, `CC BY-ND` y `CC BY-NC-SA` en registros abiertos).
  Solo se aceptan **CC0 y CC-BY 4.0**; el resto se descarta.
- La autoría es obligatoria (CC-BY exige atribución). **Quien muestre la imagen debe mostrar
  al autor y la licencia**; la API los entrega en `author`, `license` y `licenseUrl`.
- Se prefieren observaciones de personas (no especímenes de herbario), primero las tomadas
  en Colombia y luego las de cualquier país: una papa o una rosa se ve igual en todas partes.
- Se prefieren autores distintos, para tener variedad.
- Antes de guardar se comprueba con una petición `HEAD` que el enlace responde con una imagen.
- Para iNaturalist se enlaza el tamaño `large` (1024 px) y `medium` como miniatura, en vez
  del original, que puede pesar varios MB.

Las especies sin foto abierta se listan al final de la ejecución. Una causa frecuente son
los híbridos de jardín (las rosas de corte no tienen especie propia en GBIF; se representan
con *Rosa chinensis*).

## Consultar

```graphql
{
  speciesByCategory(category: FRUIT, countryIso: "CO", limit: 5) {
    displayName(countryIso: "CO")
    canonicalName
    categoryLabels
    primaryImage { url thumbnailUrl author license licenseUrl }
  }
}
```
Más ejemplos en [API.md](API.md).
