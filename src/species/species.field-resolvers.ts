import { Args, Context, ResolveField, Resolver, Parent } from '@nestjs/graphql';
import { DEFAULT_LANG, LABELS, type Lang } from '../i18n/i18n.js';
import {
  CommonName,
  InvasionStatus,
  Species,
  SpeciesImage,
} from './species.model.js';

interface GqlContext {
  lang?: Lang;
}

@Resolver(() => Species)
export class SpeciesFieldsResolver {
  @ResolveField(() => [CommonName], {
    complexity: 5,
    description:
      'Nombres comunes conocidos. Con `language` solo devuelve los de ese idioma (es, en).',
  })
  commonNames(
    @Parent() species: Species,
    @Args('language', {
      nullable: true,
      description: 'Código ISO 639-1. Si se omite, devuelve todos.',
    })
    language?: string,
  ) {
    return language
      ? species.commonNames.filter((n) => n.language === language.toLowerCase())
      : species.commonNames;
  }

  @ResolveField(() => SpeciesImage, {
    nullable: true,
    description:
      'Imagen principal, o null si la especie no tiene fotos abiertas.',
  })
  primaryImage(@Parent() species: Species) {
    return species.images[0] ?? null;
  }

  @ResolveField(() => [String], {
    description:
      'Categorías en el idioma de la respuesta (p. ej. "Frutas" o "Fruits").',
  })
  categoryLabels(@Parent() species: Species, @Context() context: GqlContext) {
    const labels = LABELS[context.lang ?? DEFAULT_LANG].category;
    return species.categories.map((c) => labels[c]);
  }

  @ResolveField(() => String, {
    description:
      'Nombre listo para mostrar: el nombre común en el idioma de la respuesta (preferido el del país indicado) o, si no hay, el nombre científico.',
  })
  displayName(
    @Parent() species: Species,
    @Context() context: GqlContext,
    @Args('countryIso', {
      nullable: true,
      description: 'País preferido, código ISO 3166-1 alfa-2.',
    })
    countryIso?: string,
  ) {
    const lang = context.lang ?? DEFAULT_LANG;
    const country = countryIso?.toUpperCase();
    const inLang = species.commonNames.filter((n) => n.language === lang);
    const best =
      inLang.find((n) => country && n.countryIso === country) ??
      inLang.find((n) => !n.countryIso) ??
      inLang[0];
    return best?.name ?? species.canonicalName;
  }
}

@Resolver(() => InvasionStatus)
export class InvasionStatusFieldsResolver {
  @ResolveField(() => String, {
    description:
      'Estatus en el idioma de la respuesta (Nativa, Introducida, Invasora).',
  })
  statusLabel(@Parent() item: InvasionStatus, @Context() context: GqlContext) {
    return LABELS[context.lang ?? DEFAULT_LANG].origin[item.status];
  }

  @ResolveField(() => String, {
    nullable: true,
    description: 'Nivel de riesgo en el idioma de la respuesta.',
  })
  riskLabel(@Parent() item: InvasionStatus, @Context() context: GqlContext) {
    return item.riskLevel
      ? LABELS[context.lang ?? DEFAULT_LANG].risk[item.riskLevel]
      : null;
  }

  @ResolveField(() => String, {
    description: 'Nivel de verificación en el idioma de la respuesta.',
  })
  verificationLabel(
    @Parent() item: InvasionStatus,
    @Context() context: GqlContext,
  ) {
    return LABELS[context.lang ?? DEFAULT_LANG].verification[item.verification];
  }
}

export const SPECIES_FIELD_RESOLVERS = [
  SpeciesFieldsResolver,
  InvasionStatusFieldsResolver,
];
