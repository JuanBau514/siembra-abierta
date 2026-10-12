import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const MAX_LIMIT = 50;
const clamp = (limit: number) => Math.min(Math.max(limit, 1), MAX_LIMIT);

const withRelations = { commonNames: true, invasionStatuses: true } as const;

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
          { scientificName: { contains: query, mode: 'insensitive' } },
          {
            commonNames: {
              some: { name: { contains: query, mode: 'insensitive' } },
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
