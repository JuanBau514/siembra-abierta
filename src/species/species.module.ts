import { Module } from '@nestjs/common';
import { SpeciesResolver } from './species.resolver.js';
import { SpeciesService } from './species.service.js';

@Module({
  providers: [SpeciesResolver, SpeciesService],
})
export class SpeciesModule {}
