import { Inject } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { InvasionStatus, Species } from './species.model.js';
import { SpeciesService } from './species.service.js';

@Resolver()
export class SpeciesResolver {
  constructor(
    @Inject(SpeciesService) private readonly species: SpeciesService,
  ) {}

  @Query(() => Species, {
    name: 'species',
    nullable: true,
    description: 'Una especie por su id.',
  })
  speciesById(@Args('id', { type: () => ID }) id: string) {
    return this.species.findById(id);
  }

  @Query(() => [Species], {
    description: 'Busca por nombre científico o nombre común.',
    complexity: ({ args, childComplexity }) =>
      childComplexity * (args.limit ?? 20),
  })
  searchSpecies(
    @Args('query') query: string,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
  ) {
    return this.species.search(query, limit);
  }

  @Query(() => [InvasionStatus], {
    description:
      'Especies invasoras registradas en un país (código ISO, p. ej. CO).',
    complexity: ({ args, childComplexity }) =>
      childComplexity * (args.limit ?? 20),
  })
  invasiveSpecies(
    @Args('countryIso') countryIso: string,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
  ) {
    return this.species.invasive(countryIso, limit);
  }
}
