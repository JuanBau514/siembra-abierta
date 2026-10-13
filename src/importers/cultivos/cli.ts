import 'dotenv/config';
import { parseArgs } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { GbifClient } from '../gbif/gbif-client.js';
import { CultivosImporter } from './import-cultivos.js';

const { values } = parseArgs({
  options: {
    images: { type: 'string', default: '4' },
    'skip-images': { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '4' },
    'dry-run': { type: 'boolean', default: false },
  },
});
const options = {
  imagesPerSpecies: Number(values.images),
  skipImages: values['skip-images']!,
  concurrency: Number(values.concurrency),
  dryRun: values['dry-run']!,
};
if (
  !Number.isInteger(options.imagesPerSpecies) ||
  options.imagesPerSpecies < 1 ||
  options.imagesPerSpecies > 10 ||
  !Number.isInteger(options.concurrency) ||
  options.concurrency < 1 ||
  options.concurrency > 16
) {
  console.error(
    'Uso: pnpm import:cultivos [--images 1..10] [--skip-images] [--concurrency 1..16] [--dry-run]',
  );
  process.exit(1);
}

const prisma = options.dryRun
  ? null
  : new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    });
try {
  console.log(
    `Importando cultivos de Colombia${options.dryRun ? ' (simulación, no escribe)' : ''}…`,
  );
  const stats = await new CultivosImporter(prisma, new GbifClient()).run(
    options,
  );
  console.log('\nResumen:', {
    ...stats,
    unresolved: stats.unresolved.length,
    speciesWithoutImages: stats.speciesWithoutImages.length,
  });
  if (stats.unresolved.length)
    console.log('Sin resolver:', stats.unresolved.join(', '));
  if (stats.speciesWithoutImages.length)
    console.log('Sin fotos abiertas:', stats.speciesWithoutImages.join(', '));
} finally {
  await prisma?.$disconnect();
}
