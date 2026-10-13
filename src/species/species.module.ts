import { Module } from '@nestjs/common';
import { SPECIES_FIELD_RESOLVERS } from './species.field-resolvers.js';
import { SpeciesResolver } from './species.resolver.js';
import { SpeciesService } from './species.service.js';

@Module({
  providers: [SpeciesResolver, ...SPECIES_FIELD_RESOLVERS, SpeciesService],
})
export class SpeciesModule {}
