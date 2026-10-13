import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import type { PlantCategoryName } from '../i18n/i18n.js';
import {
  OriginStatus,
  RiskLevel,
  VerificationStatus,
} from '../generated/prisma/enums.js';

registerEnumType(OriginStatus, {
  name: 'OriginStatus',
  description: 'Estatus de una especie en un lugar.',
  valuesMap: {
    NATIVE: { description: 'Nativa de la región.' },
    INTRODUCED: {
      description: 'Introducida por el ser humano, sin daño documentado.',
    },
    INVASIVE: {
      description: 'Introducida y con daño documentado a ecosistemas locales.',
    },
  },
});
registerEnumType(RiskLevel, {
  name: 'RiskLevel',
  description: 'Nivel de riesgo ecológico de una especie invasora.',
  valuesMap: {
    LOW: { description: 'Riesgo bajo.' },
    MEDIUM: { description: 'Riesgo medio.' },
    HIGH: { description: 'Riesgo alto.' },
  },
});
registerEnumType(VerificationStatus, {
  name: 'VerificationStatus',
  description: 'Nivel de verificación de un dato.',
  valuesMap: {
    REPORTED: { description: 'Reportado por una persona; sin corroborar.' },
    CORROBORATED: { description: 'Varios reportes independientes coinciden.' },
    EXPERT_VERIFIED: {
      description: 'Verificado por un experto o una institución.',
    },
  },
});

export enum PlantCategory {
  FRUIT = 'FRUIT',
  VEGETABLE = 'VEGETABLE',
  CROP = 'CROP',
  FLOWER = 'FLOWER',
}
registerEnumType(PlantCategory, {
  name: 'PlantCategory',
  description: 'Categoría de uso de una planta.',
  valuesMap: {
    FRUIT: { description: 'Frutas.' },
    VEGETABLE: {
      description: 'Hortalizas y verduras (incluye hierbas culinarias).',
    },
    CROP: { description: 'Cultivos de campo: café, cacao, papa, maíz.' },
    FLOWER: { description: 'Flores de corte y ornamentales.' },
  },
});

/** Código de la base de datos (español) → categoría de la API. */
export const CATEGORY_BY_CODE: Record<string, PlantCategoryName> = {
  FRUTA: 'FRUIT',
  HORTALIZA: 'VEGETABLE',
  CULTIVO: 'CROP',
  FLOR: 'FLOWER',
};
export const CODE_BY_CATEGORY: Record<PlantCategoryName, string> = {
  FRUIT: 'FRUTA',
  VEGETABLE: 'HORTALIZA',
  CROP: 'CULTIVO',
  FLOWER: 'FLOR',
};

@ObjectType({
  description:
    'Fotografía de una especie. Cada imagen trae su autoría y su licencia: al mostrarla hay que atribuir.',
})
export class SpeciesImage {
  @Field(() => ID, { description: 'Identificador de la imagen.' }) id: string;
  @Field({ description: 'Enlace a la imagen (tamaño grande).' }) url: string;
  @Field(() => String, {
    nullable: true,
    description: 'Enlace a una versión pequeña, para listas y tarjetas.',
  })
  thumbnailUrl?: string | null;
  @Field(() => String, {
    nullable: true,
    description: 'Página de origen de la foto.',
  })
  pageUrl?: string | null;
  @Field({ description: 'Autoría. Debe mostrarse junto a la imagen (CC-BY).' })
  author: string;
  @Field({ description: 'Licencia: CC0-1.0 o CC-BY-4.0.' }) license: string;
  @Field({ description: 'Enlace al texto de la licencia.' }) licenseUrl: string;
  @Field(() => String, {
    nullable: true,
    description: 'País donde se tomó, código ISO 3166-1 alfa-2.',
  })
  countryIso?: string | null;
}

@ObjectType({
  description: 'Nombre común de una especie, con su idioma y país.',
})
export class CommonName {
  @Field(() => ID, { description: 'Identificador del nombre.' }) id: string;
  @Field({ description: 'Nombre tal como se muestra al usuario.' })
  name: string;
  @Field({ description: 'Idioma, código ISO 639-1 (es, en...).' })
  language: string;
  @Field(() => String, {
    nullable: true,
    description:
      'País (ISO 3166-1 alfa-2) solo si la fuente lo indica; null si se desconoce.',
  })
  countryIso?: string | null;
  @Field(() => String, { nullable: true, description: 'Región, si se conoce.' })
  region?: string | null;
}

@ObjectType({
  description: 'Presencia de una especie en un país y su rango de altitud.',
})
export class SpeciesCountry {
  @Field({ description: 'País, código ISO 3166-1 alfa-2 (CO, EC, PA, VE).' })
  countryIso: string;
  @Field(() => Int, {
    description: 'Registros abiertos (CC0/CC-BY) de la especie en el país.',
  })
  occurrenceCount: number;
  @Field(() => Int, {
    nullable: true,
    description: 'Percentil 5 de la altitud observada (m s. n. m.).',
  })
  minElevationM?: number | null;
  @Field(() => Int, {
    nullable: true,
    description: 'Percentil 95 de la altitud observada (m s. n. m.).',
  })
  maxElevationM?: number | null;
  @Field(() => Int, {
    nullable: true,
    description: 'Registros con altitud usados para calcular el rango.',
  })
  elevationSampleSize?: number | null;
}

@ObjectType({ description: 'Especie de planta aceptada (sin sinónimos).' })
export class Species {
  @Field(() => ID, { description: 'Identificador de la especie.' }) id: string;
  @Field({ description: 'Nombre científico con autoría.' })
  scientificName: string;
  @Field({ description: 'Nombre científico sin autoría. Es único.' })
  canonicalName: string;
  @Field(() => String, { nullable: true, description: 'Género.' })
  genus?: string | null;
  @Field(() => String, { nullable: true, description: 'Familia botánica.' })
  family?: string | null;
  /** Se expone mediante `SpeciesFieldsResolver.commonNames` (acepta el argumento `language`). */
  commonNames: CommonName[];
  @Field(() => [PlantCategory], {
    description: 'Categorías de uso: fruta, hortaliza, cultivo, flor.',
  })
  categories: PlantCategoryName[];
  @Field(() => [SpeciesImage], {
    complexity: 5,
    description:
      'Fotografías con licencia abierta. La primera es la principal.',
  })
  images: SpeciesImage[];
  @Field(() => [SpeciesCountry], {
    complexity: 3,
    description: 'Países donde se registra y su rango de altitud.',
  })
  distributions: SpeciesCountry[];
  @Field(() => [InvasionStatus], {
    complexity: 5,
    description: 'Estatus nativa/introducida/invasora por lugar.',
  })
  invasionStatuses: InvasionStatus[];
}

// InvasionStatus va después de Species: en ESM, el tipo `Species` de la
// propiedad `species` se evalúa al declarar la clase.
@ObjectType({
  description:
    'Estatus de una especie en un lugar. Una especie puede ser invasora en un piso térmico y no en otro.',
})
export class InvasionStatus {
  @Field(() => ID, { description: 'Identificador del registro.' }) id: string;
  @Field(() => OriginStatus, { description: 'Nativa, introducida o invasora.' })
  status: OriginStatus;
  @Field(() => RiskLevel, {
    nullable: true,
    description: 'Riesgo ecológico, si se conoce.',
  })
  riskLevel?: RiskLevel | null;
  @Field({ description: 'País, código ISO 3166-1 alfa-2.' }) countryIso: string;
  @Field(() => String, { nullable: true, description: 'Región, si aplica.' })
  region?: string | null;
  @Field(() => Int, {
    nullable: true,
    description: 'Altitud mínima donde aplica el estatus (m s. n. m.).',
  })
  minElevationM?: number | null;
  @Field(() => Int, {
    nullable: true,
    description: 'Altitud máxima donde aplica el estatus (m s. n. m.).',
  })
  maxElevationM?: number | null;
  @Field(() => String, {
    nullable: true,
    description: 'Daño que causa al ecosistema.',
  })
  impact?: string | null;
  @Field(() => String, {
    nullable: true,
    description: 'Recomendación de manejo o control.',
  })
  management?: string | null;
  @Field(() => VerificationStatus, {
    description: 'Nivel de verificación del dato.',
  })
  verification: VerificationStatus;
  @Field(() => Species, { nullable: true, description: 'Especie afectada.' })
  species?: Species;
}
