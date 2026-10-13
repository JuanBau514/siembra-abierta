# Base de datos: cómo explorarla

PostgreSQL 17 en Docker. Estructura completa y diagrama:
[database/SCHEMA.md](database/SCHEMA.md) (generado).

## Conectarte con DBeaver

1. Levanta la base de datos: `pnpm db:up`.
2. En DBeaver: **Base de datos → Nueva conexión → PostgreSQL → Siguiente**.
3. Completa:

   | Campo | Valor |
   |---|---|
   | Host | `localhost` |
   | Puerto | `5432` |
   | Base de datos | `siembra_abierta` |
   | Usuario | `siembra` |
   | Contraseña | `siembra` |

4. **Probar conexión**. La primera vez DBeaver ofrece descargar el driver de
   PostgreSQL: acepta.
5. Las tablas están en **siembra_abierta → Esquemas → public → Tablas**.

> Estas credenciales son solo para desarrollo local. El puerto solo escucha en
> `127.0.0.1`, así que nadie más en tu red puede conectarse. No las uses en producción.

### Ver el diagrama entidad-relación en DBeaver

Despliega **public → Tablas**, selecciona todas las tablas, clic derecho →
**Ver diagrama** (*View Diagram*). Muestra las llaves foráneas y las relaciones.

### Revisar la normalización de los datos

Abre un editor SQL (**Ctrl/Cmd + ]**) y usa
[database/verificacion.sql](database/verificacion.sql). Incluye conteos por tabla,
chequeos que **deben dar 0 filas** (nombres mal normalizados, altitudes invertidas,
familias sin géneros, especies sin país) y consultas informativas, por
ejemplo cuántos nombres comunes tienen país conocido.

También puedes usar la terminal o Prisma Studio:

```bash
docker exec -it siembra-abierta-db psql -U siembra -d siembra_abierta
pnpm prisma:studio
```

## Idioma de la base de datos

Las tablas, columnas y enumeraciones están **en español** (`especies`, `nombres_comunes`,
`pais_codigo`...), en `snake_case` y sin acentos. El código (TypeScript, Prisma, GraphQL)
usa nombres en inglés y se conecta con la base de datos mediante `@@map` y `@map` en
`prisma/schema.prisma`. El diccionario [database/SCHEMA.md](database/SCHEMA.md) muestra
ambos nombres lado a lado (`Columna` y `Campo (código)`).

## Normalización: tercera forma normal (3FN)

Cada dato depende de la clave de su tabla, de toda la clave y de nada más.

| Antes (violaba la 3FN) | Ahora |
|---|---|
| `especies.familia` y `especies.genero` como texto: la familia depende del género, no de la especie | `familias` ← `generos` ← `especies` |
| `especies.nombre_canonico` repetía género + epíteto | `especies` guarda `genero_id` y `epiteto`; el nombre completo se arma al leer |
| `fuentes.licencia` y `fuentes.url_licencia`: la URL depende de la licencia | `licencias` (código, nombre, URL) y `fuentes.licencia_codigo` |
| Códigos de país e idioma escritos como texto libre | `paises` e `idiomas` como tablas de referencia con llave foránea |
| Altitud en `especies`, aunque depende del país | `especies_paises` |

**Excepción deliberada:** las columnas `nombre_normalizado` (`especies` y
`nombres_comunes`) son datos derivados, que el importador mantiene para buscar sin
acentos ni mayúsculas. Estrictamente la 3FN no los admite; se aceptan por rendimiento y
[database/verificacion.sql](database/verificacion.sql) comprueba que siempre coincidan
con el dato original.

## Otras reglas

- Una tabla por concepto; las fuentes viven en `fuentes` y se referencian por id.
- Países en ISO 3166-1 alfa-2 en mayúsculas; idiomas en ISO 639-1.
- Si la fuente no dice el país de un nombre, queda `null`: no se supone.
- Solo licencias CC0 y CC-BY. Todo dato apunta a su fuente.

## Cómo cambiar el esquema

1. Edita `prisma/schema.prisma` y documenta tablas y columnas con `///`.
2. Crea la migración: `pnpm prisma:migrate` (pide un nombre).
3. Regenera la documentación: `pnpm docs:generate`.
4. Haz commit del esquema, de la migración **y** de los documentos generados.

`pnpm docs:check` (también en la CI) falla si te olvidas del paso 3.
