import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  OriginStatus,
  RiskLevel,
  VerificationStatus,
} from '../generated/prisma/enums.js';

registerEnumType(OriginStatus, { name: 'OriginStatus' });
registerEnumType(RiskLevel, { name: 'RiskLevel' });
registerEnumType(VerificationStatus, { name: 'VerificationStatus' });

@ObjectType()
export class CommonName {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field() language: string;
  @Field(() => String, { nullable: true }) countryIso?: string | null;
  @Field(() => String, { nullable: true }) region?: string | null;
}

@ObjectType()
export class SpeciesCountry {
  @Field() countryIso: string;
  @Field(() => Int) occurrenceCount: number;
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
  @Field(() => Int, { nullable: true }) elevationSampleSize?: number | null;
}

@ObjectType()
export class Species {
  @Field(() => ID) id: string;
  @Field() scientificName: string;
  @Field() canonicalName: string;
  @Field(() => String, { nullable: true }) genus?: string | null;
  @Field(() => String, { nullable: true }) family?: string | null;
  @Field(() => [CommonName], { complexity: 5 }) commonNames: CommonName[];
  @Field(() => [SpeciesCountry], { complexity: 3 })
  distributions: SpeciesCountry[];
  @Field(() => [InvasionStatus], { complexity: 5 })
  invasionStatuses: InvasionStatus[];
}

// InvasionStatus va después de Species: en ESM, el tipo `Species` de la
// propiedad `species` se evalúa al declarar la clase.
@ObjectType()
export class InvasionStatus {
  @Field(() => ID) id: string;
  @Field(() => OriginStatus) status: OriginStatus;
  @Field(() => RiskLevel, { nullable: true }) riskLevel?: RiskLevel | null;
  @Field() countryIso: string;
  @Field(() => String, { nullable: true }) region?: string | null;
  @Field(() => Int, { nullable: true }) minElevationM?: number | null;
  @Field(() => Int, { nullable: true }) maxElevationM?: number | null;
  @Field(() => String, { nullable: true }) impact?: string | null;
  @Field(() => String, { nullable: true }) management?: string | null;
  @Field(() => VerificationStatus) verification: VerificationStatus;
  @Field(() => Species, { nullable: true }) species?: Species;
}
