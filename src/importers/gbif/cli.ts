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
    languages: { type: 'string', default: 'spa' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const options = {
  country: values.country!,
  limit: Number(values.limit),
  basisOfRecord: values.basis!,
  languages: values.languages!.split(',').map((l) => l.trim().toLowerCase()),
  dryRun: values['dry-run']!,
};
if (
  !/^[A-Za-z]{2}$/.test(options.country) ||
  !Number.isInteger(options.limit) ||
  options.limit < 1 ||
  options.limit > 1000
) {
  console.error(
    'Uso: --country CO --limit 1..1000 [--basis HUMAN_OBSERVATION] [--languages spa] [--dry-run]',
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
  const stats = await new GbifImporter(prisma, new GbifClient()).run(options);
  console.log('\nResumen:', stats);
} finally {
  await prisma?.$disconnect();
}
