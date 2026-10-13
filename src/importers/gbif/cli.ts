import 'dotenv/config';
import { parseArgs } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { GbifClient } from './gbif-client.js';
import { GbifImporter } from './import-gbif.js';

const { values } = parseArgs({
  options: {
    country: { type: 'string', default: 'CO' },
    limit: { type: 'string', default: '50' },
    basis: { type: 'string', default: 'HUMAN_OBSERVATION' },
    concurrency: { type: 'string', default: '4' },
    'skip-existing': { type: 'boolean', default: false },
    languages: { type: 'string', default: 'spa' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const options = {
  country: values.country!,
  limit: Number(values.limit),
  basisOfRecord: values.basis!.toUpperCase() === 'ALL' ? null : values.basis!,
  concurrency: Number(values.concurrency),
  skipExisting: values['skip-existing']!,
  languages: values.languages!.split(',').map((l) => l.trim().toLowerCase()),
  dryRun: values['dry-run']!,
};
if (
  !/^[A-Za-z]{2}$/.test(options.country) ||
  !Number.isInteger(options.concurrency) ||
  options.concurrency < 1 ||
  options.concurrency > 16 ||
  !Number.isInteger(options.limit) ||
  options.limit < 1 ||
  options.limit > 200000
) {
  console.error(
    'Uso: --country CO --limit 1..200000 [--basis HUMAN_OBSERVATION|ALL] [--languages spa] [--concurrency 4] [--skip-existing] [--dry-run]',
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
    `Importando ${options.limit} especies de ${options.country.toUpperCase()}${options.dryRun ? ' (simulación, no escribe)' : ''}…`,
  );
  const importer = new GbifImporter(prisma, new GbifClient());
  const stats = await importer.run(options);
  console.log('\nResumen:', stats);
  if (importer.failedSpecies.length > 0) {
    console.log(
      'Especies fallidas (reintenta con --skip-existing):',
      importer.failedSpecies.map((f) => f.key).join(', '),
    );
  }
} finally {
  await prisma?.$disconnect();
}
