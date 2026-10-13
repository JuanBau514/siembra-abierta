import { Inject } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { InvasionStatus, PlantCategory, Species } from './species.model.js';
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
  speciesById(
    @Args('id', { type: () => ID, description: 'Identificador de la especie.' })
    id: string,
  ) {
    return this.species.findById(id);
  }

  @Query(() => [Species], {
    description: 'Busca por nombre científico o nombre común.',
    complexity: ({ args, childComplexity }) =>
      childComplexity * (args.limit ?? 20),
  })
  searchSpecies(
    @Args('query', {
      description: 'Texto a buscar. Ignora mayúsculas y acentos.',
    })
    query: string,
    @Args('limit', {
      type: () => Int,
      defaultValue: 20,
      description: 'Máximo de resultados (1 a 50).',
    })
    limit: number,
  ) {
    return this.species.search(query, limit);
  }

  @Query(() => [Species], {
    description:
      'Especies de una categoría (frutas, hortalizas, cultivos, flores) en un país, en orden alfabético.',
    complexity: ({ args, childComplexity }) =>
      childComplexity * (args.limit ?? 20),
  })
  speciesByCategory(
    @Args('category', {
      type: () => PlantCategory,
      description: 'Categoría de uso.',
    })
    category: PlantCategory,
    @Args('countryIso', {
      defaultValue: 'CO',
      description: 'País, código ISO 3166-1 alfa-2. Por defecto CO.',
    })
    countryIso: string,
    @Args('limit', {
      type: () => Int,
      defaultValue: 20,
      description: 'Máximo de resultados (1 a 50).',
    })
    limit: number,
    @Args('offset', {
      type: () => Int,
      defaultValue: 0,
      description: 'Cuántos resultados saltar, para paginar.',
    })
    offset: number,
  ) {
    return this.species.byCategory(category, countryIso, limit, offset);
  }

  @Query(() => [InvasionStatus], {
    description:
      'Especies invasoras registradas en un país (código ISO, p. ej. CO).',
    complexity: ({ args, childComplexity }) =>
      childComplexity * (args.limit ?? 20),
  })
  invasiveSpecies(
    @Args('countryIso', {
      description: 'País, código ISO 3166-1 alfa-2 (CO, EC, PA, VE).',
    })
    countryIso: string,
    @Args('limit', {
      type: () => Int,
      defaultValue: 20,
      description: 'Máximo de resultados (1 a 50).',
    })
    limit: number,
  ) {
    return this.species.invasive(countryIso, limit);
  }
}
