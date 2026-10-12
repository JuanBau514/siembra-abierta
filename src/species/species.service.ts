import { Inject, Injectable } from '@nestjs/common';
import { normalizeText } from '../importers/gbif/normalize.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_LIMIT = 50;
const clamp = (limit: number) => Math.min(Math.max(limit, 1), MAX_LIMIT);

const withRelations = {
  commonNames: true,
  distributions: true,
  invasionStatuses: true,
} as const;

@Injectable()
export class SpeciesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.species.findUnique({
      where: { id },
      include: withRelations,
    });
  }

  search(query: string, limit: number) {
    return this.prisma.species.findMany({
      where: {
        OR: [
          { nameNormalized: { contains: normalizeText(query) } },
          {
            commonNames: {
              some: { nameNormalized: { contains: normalizeText(query) } },
            },
          },
        ],
      },
      include: withRelations,
      orderBy: { scientificName: 'asc' },
      take: clamp(limit),
    });
  }

  invasive(countryIso: string, limit: number) {
    return this.prisma.invasionStatus.findMany({
      where: { countryIso: countryIso.toUpperCase(), status: 'INVASIVE' },
      include: { species: { include: withRelations } },
      orderBy: { riskLevel: 'desc' },
      take: clamp(limit),
    });
  }
}
