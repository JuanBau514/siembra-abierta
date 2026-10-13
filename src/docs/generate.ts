import { NestFactory } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import pkg from '@prisma/internals';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SPECIES_FIELD_RESOLVERS } from '../species/species.field-resolvers.js';
import { SpeciesResolver } from '../species/species.resolver.js';
import { renderApiReference, renderSdl } from './api-docs.js';
import { renderDatabaseDocs, type Dmmf } from './database-docs.js';

const { getDMMF } = pkg;
const check = process.argv.includes('--check');
const root = process.cwd();

async function buildSchema() {
  const app = await NestFactory.create(GraphQLSchemaBuilderModule, {
    logger: false,
  });
  await app.init();
  const schema = await app
    .get(GraphQLSchemaFactory)
    .create([SpeciesResolver, ...SPECIES_FIELD_RESOLVERS]);
  await app.close();
  return schema;
}

const schema = await buildSchema();
const dmmf = (await getDMMF({
  datamodel: await readFile(join(root, 'prisma/schema.prisma'), 'utf8'),
})) as unknown as Dmmf;
const migrations = (
  await readdir(join(root, 'prisma/migrations'), { withFileTypes: true })
)
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const files: Record<string, string> = {
  'docs/api/REFERENCE.md': renderApiReference(schema),
  'docs/api/schema.graphql': renderSdl(schema),
  'docs/database/SCHEMA.md': renderDatabaseDocs(dmmf, migrations),
};

let stale = false;
for (const [path, content] of Object.entries(files)) {
  const full = join(root, path);
  if (check) {
    const current = await readFile(full, 'utf8').catch(() => null);
    if (current !== content) {
      stale = true;
      console.error(`Desactualizado: ${path}`);
    }
  } else {
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
    console.log(`Generado ${path}`);
  }
}
if (check) {
  if (stale) {
    console.error(
      '\nLa documentación no coincide con el código. Ejecuta: pnpm docs:generate',
    );
    process.exit(1);
  }
  console.log('La documentación está al día.');
}
